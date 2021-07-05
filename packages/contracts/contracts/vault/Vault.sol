// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

import "../helpers/Utils.sol";
import "../helpers/FixedPoint.sol";
import "../helpers/BytesHelpers.sol";

import "../interfaces/IPortfolio.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/ISwapConnector.sol";
import "../interfaces/IVault.sol";

contract Vault is IVault, Ownable, ReentrancyGuard {
    using Address for address;
    using SafeERC20 for IERC20;
    using FixedPoint for uint256;
    using BytesHelpers for bytes4;

    uint256 private constant _MAX_PROTOCOL_FEE = 0.05e18; // 5%

    struct Account {
        mapping (address => uint256) balance;
        mapping (address => uint256) shares;
        mapping (address => uint256) invested;
    }

    uint256 public override protocolFee;
    address public override swapConnector;
    mapping (address => bool) public override isStrategyWhitelisted;

    mapping (address => Account) internal accounts;

    modifier authenticate(address account, bytes32[] memory params) {
        _authenticate(account, params);
        _;
    }

    constructor (uint256 _protocolFee, address _swapConnector, address[] memory _whitelistedStrategies) {
        setProtocolFee(_protocolFee);
        setSwapConnector(_swapConnector);
        setWhitelistedStrategies(_whitelistedStrategies, trues(_whitelistedStrategies.length));
    }

    function getAccountBalance(address accountAddress, address token) external override view returns (uint256) {
        Account storage account = accounts[accountAddress];
        return account.balance[token];
    }

    function getAccountInvestment(address accountAddress, address strategy) external override view returns (uint256 invested, uint256 shares) {
        Account storage account = accounts[accountAddress];
        invested = account.invested[strategy];
        shares = account.shares[strategy];
    }

    function batch(bytes[] memory data) external override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint i = 0; i < data.length; i++) {
            results[i] = Address.functionDelegateCall(address(this), data[i]);
        }
    }

    function deposit(address accountAddress, address[] memory tokens, uint256[] memory amounts)
        external
        override
        nonReentrant
        authenticate(accountAddress, arr())
    {
        require(tokens.length > 0, "INVALID_TOKENS_LENGTH");
        require(tokens.length == amounts.length, "INVALID_AMOUNTS_LENGTH");

        uint256 depositFee;
        address feeCollector;
        if (accountAddress.isContract()) {
            IPortfolio(accountAddress).approveTokens(tokens);
            (depositFee, feeCollector) = IPortfolio(accountAddress).getDepositFee();
        }

        Account storage account = accounts[accountAddress];
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = amounts[i];
            _safeTransferFrom(token, accountAddress, amount);

            uint256 depositFeeAmount;
            if (depositFee > 0) {
                depositFeeAmount = amount.mul(depositFee);
                _safeTransfer(token, feeCollector, depositFeeAmount);
            }

            uint256 amountAfterFees = amount.sub(depositFeeAmount);
            account.balance[token] = account.balance[token].add(amountAfterFees);
        }

        emit Deposited(accountAddress, tokens, amounts, msg.sender);
    }

    function withdraw(address accountAddress, address[] memory tokens, uint256[] memory amounts, address recipient)
        external
        override
        nonReentrant
        authenticate(accountAddress, arr(recipient))
    {
        require(tokens.length > 0, "INVALID_TOKENS_LENGTH");
        require(tokens.length == amounts.length, "INVALID_AMOUNTS_LENGTH");

        Account storage account = accounts[accountAddress];
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = amounts[i];

            uint256 currentBalance = account.balance[token];
            require(currentBalance >= amount, "ACCOUNT_INSUFFICIENT_BALANCE");

            account.balance[token] = currentBalance.sub(amount);
            _safeTransfer(token, recipient, amount);
        }

        emit Withdrawn(accountAddress, tokens, amounts, recipient, msg.sender);
    }

    function joinSwap(address accountAddress, address strategy, address token, uint256 amountIn, uint256 minAmountOut, bytes memory data)
        external
        override
    {
        address strategyToken = IStrategy(strategy).getToken();
        require(strategyToken != token, "JOIN_SWAP_INVALID_TOKEN");
        uint256 amountOut = _swap(token, strategyToken, amountIn, minAmountOut, data);
        join(accountAddress, strategy, amountOut, data);
    }

    function join(address accountAddress, address strategy, uint256 amount, bytes memory data)
        public
        override
        nonReentrant
        authenticate(accountAddress, arr(strategy, amount))
    {
        address token = IStrategy(strategy).getToken();
        Account storage account = accounts[accountAddress];
        uint256 currentBalance = account.balance[token];
        require(currentBalance >= amount, "ACCOUNT_INSUFFICIENT_BALANCE");
        account.balance[token] = currentBalance.sub(amount);

        uint256 shares = IStrategy(strategy).onJoin(amount, data);
        account.shares[strategy] = account.shares[strategy].add(shares);
        account.invested[strategy] = account.invested[strategy].add(amount);

        _safeTransfer(token, strategy, amount);
        emit Joined(accountAddress, strategy, amount, shares, msg.sender);
    }

    function exit(address accountAddress, address strategy, uint256 ratio, bytes memory data)
        external
        override
        nonReentrant
        authenticate(accountAddress, arr(strategy, ratio))
    {
        require(ratio <= FixedPoint.ONE, "INVALID_EXIT_RATIO");

        Account storage account = accounts[accountAddress];
        uint256 currentShares = account.shares[strategy];
        uint256 exitingShares = currentShares.mul(ratio);
        require(exitingShares > 0, "EXIT_SHARES_ZERO");
        require(currentShares > exitingShares, "ACCOUNT_INSUFFICIENT_SHARES");
        account.shares[strategy] = currentShares - exitingShares;

        (address token, uint256 amountReceived) = IStrategy(strategy).onExit(exitingShares, data);
        _safeTransferFrom(token, strategy, amountReceived);

        uint256 invested = account.invested[strategy];
        (uint256 protocolFeeAmount, uint256 performanceFeeAmount) = _payExitFees(accountAddress, token, invested.mul(ratio), amountReceived);

        account.invested[strategy] = invested.sub(amountReceived);
        uint256 amountAfterFees = amountReceived.sub(protocolFeeAmount).sub(performanceFeeAmount);
        account.balance[token] = account.balance[token].add(amountAfterFees);
        emit Exited(accountAddress, strategy, amountReceived, exitingShares, protocolFeeAmount, performanceFeeAmount, msg.sender);
    }

    function setProtocolFee(uint256 newProtocolFee) public override nonReentrant onlyOwner {
        require(newProtocolFee <= _MAX_PROTOCOL_FEE, "PROTOCOL_FEE_TOO_HIGH");
        protocolFee = newProtocolFee;
        emit ProtocolFeeChanged(newProtocolFee);
    }

    function setSwapConnector(address newSwapConnector) public override nonReentrant onlyOwner {
        require(newSwapConnector.isContract(), "SWAP_CONNECTOR_NOT_CONTRACT");
        swapConnector = newSwapConnector;
        emit SwapConnectorChanged(newSwapConnector);
    }

    function setWhitelistedStrategies(address[] memory strategies, bool[] memory whitelisted)
        public
        override
        nonReentrant
        onlyOwner
    {
        require(strategies.length == whitelisted.length, "INVALID_WHITELISTED_LENGTH");

        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            require(strategy.isContract(), "STRATEGY_NOT_CONTRACT");
            isStrategyWhitelisted[strategy] = whitelisted[i];
            emit WhitelistedStrategyChanged(strategy, whitelisted[i]);
        }
    }

    function _payExitFees(address accountAddress, address token, uint256 deposited, uint256 received)
        internal
        returns (uint256 protocolFeeAmount, uint256 performanceFeeAmount)
    {
        uint256 gains = received > deposited ? received - deposited : 0;

        if (protocolFee > 0) {
            protocolFeeAmount = gains.mul(protocolFee);
            _safeTransfer(token, owner(), protocolFeeAmount);
        }

        if (accountAddress.isContract()) {
            (uint256 performanceFee, address feeCollector) = IPortfolio(accountAddress).getPerformanceFee();
            if (performanceFee > 0) {
                uint256 gainsAfterProtocolFees = gains.sub(protocolFeeAmount);
                performanceFeeAmount = gainsAfterProtocolFees.mul(performanceFee);
                _safeTransfer(token, feeCollector, performanceFeeAmount);
            }
        }
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes memory data) internal returns (uint256) {
        uint256 amountOut = ISwapConnector(swapConnector).getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "SWAP_MIN_AMOUNT");
        _safeTransfer(tokenIn, swapConnector, amountIn);

        ISwapConnector(swapConnector).swap(tokenIn, tokenOut, amountIn, minAmountOut, block.timestamp, data);
        _safeTransferFrom(tokenOut, swapConnector, amountOut);
        return amountOut;
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _safeTransferFrom(address token, address from, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).safeTransferFrom(from, address(this), amount);
        }
    }

    function _authenticate(address account, bytes32[] memory params) internal view {
        require(_canPerform(account, params), "SENDER_NOT_ALLOWED");
    }

    function _canPerform(address account, bytes32[] memory params) internal view returns (bool) {
        // Allow users operating on their behalf
        if (msg.sender == account) {
            return true;
        }

        // Disallow users operating on behalf of foreign EOAs
        if (!account.isContract()) {
            return false;
        }

        // Finally, ask the account if the sender can operate on their behalf
        return IPortfolio(account).canPerform(msg.sender, address(this), msg.sig.toBytes32(), params);
    }
}
