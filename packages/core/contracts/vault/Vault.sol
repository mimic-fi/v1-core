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
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../libraries/Utils.sol";
import "../libraries/Accounts.sol";
import "../libraries/FixedPoint.sol";
import "../libraries/BytesHelpers.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/ISwapConnector.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IVault.sol";

contract Vault is IVault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using FixedPoint for uint256;
    using BytesHelpers for bytes4;
    using Accounts for Accounts.Data;

    uint256 private constant _MAX_SLIPPAGE = 1e18; // 100%
    uint256 private constant _MAX_PROTOCOL_FEE = 5e16; // 5%

    struct Accounting {
        mapping (address => uint256) balance;
        mapping (address => uint256) shares;
        mapping (address => uint256) invested;
    }

    uint256 public override protocolFee;
    address public override priceOracle;
    address public override swapConnector;
    mapping (address => bool) public override isTokenWhitelisted;
    mapping (address => bool) public override isStrategyWhitelisted;

    mapping (address => Accounting) internal accountings;

    constructor (uint256 _protocolFee, address _priceOracle, address _swapConnector, address[] memory _whitelistedTokens, address[] memory _whitelistedStrategies) {
        setProtocolFee(_protocolFee);
        setPriceOracle(_priceOracle);
        setSwapConnector(_swapConnector);
        setWhitelistedTokens(_whitelistedTokens, trues(_whitelistedTokens.length));
        setWhitelistedStrategies(_whitelistedStrategies, trues(_whitelistedStrategies.length));
    }

    function getAccountBalance(address accountAddress, address token) external override view returns (uint256) {
        Accounting storage accounting = accountings[accountAddress];
        return accounting.balance[token];
    }

    function getAccountInvestment(address accountAddress, address strategy) external override view returns (uint256 invested, uint256 shares) {
        Accounting storage accounting = accountings[accountAddress];
        invested = accounting.invested[strategy];
        shares = accounting.shares[strategy];
    }

    function setProtocolFee(uint256 newProtocolFee) public override nonReentrant onlyOwner {
        require(newProtocolFee <= _MAX_PROTOCOL_FEE, "PROTOCOL_FEE_TOO_HIGH");
        protocolFee = newProtocolFee;
        emit ProtocolFeeSet(newProtocolFee);
    }

    function setPriceOracle(address newPriceOracle) public override nonReentrant onlyOwner {
        require(newPriceOracle != address(0), "PRICE_ORACLE_ZERO_ADDRESS");
        priceOracle = newPriceOracle;
        emit PriceOracleSet(newPriceOracle);
    }

    function setSwapConnector(address newSwapConnector) public override nonReentrant onlyOwner {
        require(newSwapConnector != address(0), "SWAP_CONNECTOR_ZERO_ADDRESS");
        swapConnector = newSwapConnector;
        emit SwapConnectorSet(newSwapConnector);
    }

    function setWhitelistedTokens(address[] memory tokens, bool[] memory whitelisted) public override nonReentrant onlyOwner {
        require(tokens.length == whitelisted.length, "INVALID_WHITELISTED_LENGTH");
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), "TOKEN_ZERO_ADDRESS");
            isTokenWhitelisted[token] = whitelisted[i];
            emit WhitelistedTokenSet(token, whitelisted[i]);
        }
    }

    function setWhitelistedStrategies(address[] memory strategies, bool[] memory whitelisted) public override nonReentrant onlyOwner {
        require(strategies.length == whitelisted.length, "INVALID_WHITELISTED_LENGTH");
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            require(strategy != address(0), "STRATEGY_ZERO_ADDRESS");
            isStrategyWhitelisted[strategy] = whitelisted[i];
            emit WhitelistedStrategySet(strategy, whitelisted[i]);
        }
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
    {
        Accounts.Data memory account = _authenticate(accountAddress, arr());
        account.beforeDeposit(msg.sender, tokens, amounts);
        _deposit(account, tokens, amounts);
        account.afterDeposit(msg.sender, tokens, amounts);
    }

    function withdraw(address accountAddress, address[] memory tokens, uint256[] memory amounts, address recipient)
        external
        override
        nonReentrant
    {
        Accounts.Data memory account = _authenticate(accountAddress, arr(recipient));
        account.beforeWithdraw(msg.sender, tokens, amounts, recipient);
        _withdraw(account, tokens, amounts, recipient);
        account.afterWithdraw(msg.sender, tokens, amounts, recipient);
    }

    function swap(address accountAddress, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data)
        external
        override
        nonReentrant
    {
        Accounts.Data memory account = _authenticate(accountAddress, arr(tokenIn, tokenOut, amountIn, slippage));
        account.beforeSwap(msg.sender, tokenIn, tokenOut, amountIn, slippage, data);
        _swap(account, tokenIn, tokenOut, amountIn, slippage, data);
        account.afterSwap(msg.sender, tokenIn, tokenOut, amountIn, slippage, data);
    }

    function join(address accountAddress, address strategy, uint256 amount, bytes memory data)
        external
        override
        nonReentrant
    {
        Accounts.Data memory account = _authenticate(accountAddress, arr(strategy, amount));
        account.beforeJoin(msg.sender, strategy, amount, data);
        _join(account, strategy, amount, data);
        account.afterJoin(msg.sender, strategy, amount, data);
    }

    function exit(address accountAddress, address strategy, uint256 ratio, bytes memory data)
        external
        override
        nonReentrant
    {
        Accounts.Data memory account = _authenticate(accountAddress, arr(strategy, ratio));
        account.beforeExit(msg.sender, strategy, ratio, data);
        _exit(account, strategy, ratio, data);
        account.afterExit(msg.sender, strategy, ratio, data);
    }

    function _deposit(Accounts.Data memory account, address[] memory tokens, uint256[] memory amounts) internal {
        require(tokens.length > 0, "INVALID_TOKENS_LENGTH");
        require(tokens.length == amounts.length, "INVALID_AMOUNTS_LENGTH");

        (uint256 depositFee, address feeCollector) = account.getDepositFee();
        Accounting storage accounting = accountings[account.addr];
        uint256[] memory depositFees = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = amounts[i];
            require(amount > 0, "DEPOSIT_AMOUNT_ZERO");

            address token = tokens[i];
            _safeTransferFrom(token, account.addr, address(this), amount);

            uint256 depositFeeAmount = amount.mulDown(depositFee);
            _safeTransfer(token, feeCollector, depositFeeAmount);

            depositFees[i] = depositFeeAmount;
            uint256 amountAfterFees = amount.sub(depositFeeAmount);
            accounting.balance[token] = accounting.balance[token].add(amountAfterFees);
        }

        emit Deposit(account.addr, tokens, amounts, depositFees);
    }

    function _withdraw(Accounts.Data memory account, address[] memory tokens, uint256[] memory amounts, address recipient) internal {
        require(tokens.length > 0, "INVALID_TOKENS_LENGTH");
        require(tokens.length == amounts.length, "INVALID_AMOUNTS_LENGTH");

        Accounting storage accounting = accountings[account.addr];
        uint256[] memory fromVault = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = amounts[i];
            require(amount > 0, "WITHDRAW_AMOUNT_ZERO");

            address token = tokens[i];
            uint256 vaultBalance = accounting.balance[token];
            uint256 accountBalance = account.isPortfolio ? IERC20(token).balanceOf(account.addr) : 0;
            require(vaultBalance.add(accountBalance) >= amount, "ACCOUNTING_INSUFFICIENT_BALANCE");

            uint256 fromAccount = Math.min(accountBalance, amount);
            _safeTransferFrom(token, account.addr, recipient, fromAccount);

            if (fromAccount < amount) {
                fromVault[i] = amount - fromAccount;
                _safeTransfer(token, recipient, fromVault[i]);
                accounting.balance[token] = vaultBalance.sub(fromVault[i]);
            }
        }

        emit Withdraw(account.addr, tokens, amounts, fromVault, recipient);
    }

    function _swap(Accounts.Data memory account, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) internal {
        require(tokenIn != tokenOut, "SWAP_SAME_TOKEN");
        require(slippage <= _MAX_SLIPPAGE, "SWAP_MAX_SLIPPAGE");

        Accounting storage accounting = accountings[account.addr];
        uint256 currentBalance = accounting.balance[tokenIn];
        require(currentBalance >= amountIn, "ACCOUNTING_INSUFFICIENT_BALANCE");

        uint256 amountOut;
        uint256 remainingIn;
        { // scope to avoid stack too deep
            uint256 price = IPriceOracle(priceOracle).getTokenPrice(tokenIn, tokenOut);
            uint256 minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
            require(ISwapConnector(swapConnector).getAmountOut(tokenIn, tokenOut, amountIn) >= minAmountOut, "EXPECTED_SWAP_MIN_AMOUNT");

            _safeTransfer(tokenIn, swapConnector, amountIn);
            uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
            uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));
            (remainingIn, amountOut) = ISwapConnector(swapConnector).swap(tokenIn, tokenOut, amountIn, minAmountOut, block.timestamp, data);

            uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
            require(postBalanceIn.sub(preBalanceIn) >= remainingIn, "SWAP_INVALID_REMAINING_IN");

            uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
            require(amountOut >= minAmountOut, "SWAP_MIN_AMOUNT");
            require(postBalanceOut.sub(preBalanceOut) >= amountOut, "SWAP_INVALID_AMOUNT_OUT");
        }

        accounting.balance[tokenIn] = currentBalance.sub(amountIn).add(remainingIn);
        accounting.balance[tokenOut] = accounting.balance[tokenOut].add(amountOut);
        emit Swap(account.addr, tokenIn, tokenOut, amountIn, remainingIn, amountOut, data);
    }

    function _join(Accounts.Data memory account, address strategy, uint256 amount, bytes memory data) internal {
        require(amount > 0, "JOIN_AMOUNT_ZERO");

        address token = IStrategy(strategy).getToken();
        Accounting storage accounting = accountings[account.addr];
        uint256 currentBalance = accounting.balance[token];
        require(currentBalance >= amount, "ACCOUNTING_INSUFFICIENT_BALANCE");
        accounting.balance[token] = currentBalance.sub(amount);

        _safeTransfer(token, strategy, amount);
        uint256 shares = IStrategy(strategy).onJoin(amount, data);
        accounting.shares[strategy] = accounting.shares[strategy].add(shares);
        accounting.invested[strategy] = accounting.invested[strategy].add(amount);
        emit Join(account.addr, strategy, amount, shares);
    }

    function _exit(Accounts.Data memory account, address strategy, uint256 ratio, bytes memory data) internal {
        require(ratio > 0, "EXIT_RATIO_ZERO");
        require(ratio <= FixedPoint.ONE, "INVALID_EXIT_RATIO");

        Accounting storage accounting = accountings[account.addr];
        uint256 currentShares = accounting.shares[strategy];
        uint256 exitingShares = currentShares.mulDown(ratio);
        require(exitingShares > 0, "EXIT_SHARES_ZERO");
        require(currentShares >= exitingShares, "ACCOUNT_INSUFFICIENT_SHARES");
        accounting.shares[strategy] = currentShares - exitingShares;

        (address token, uint256 amountReceived) = IStrategy(strategy).onExit(exitingShares, data);
        _safeTransferFrom(token, strategy, address(this), amountReceived);

        uint256 invested = accounting.invested[strategy];
        uint256 deposited = invested.mulUp(ratio);
        (uint256 protocolFeeAmount, uint256 performanceFeeAmount) = _payExitFees(account, token, deposited, amountReceived);

        accounting.invested[strategy] = invested.sub(deposited);
        uint256 amountAfterFees = amountReceived.sub(protocolFeeAmount).sub(performanceFeeAmount);
        accounting.balance[token] = accounting.balance[token].add(amountAfterFees);
        emit Exit(account.addr, strategy, deposited, amountReceived, exitingShares, protocolFeeAmount, performanceFeeAmount);
    }

    function _payExitFees(Accounts.Data memory account, address token, uint256 deposited, uint256 received)
        private
        returns (uint256 protocolFeeAmount, uint256 performanceFeeAmount)
    {
        if (deposited >= received) {
            return (0, 0);
        }

        uint256 gains = received - deposited;
        protocolFeeAmount = gains.mulUp(protocolFee);
        _safeTransfer(token, owner(), protocolFeeAmount);

        uint256 gainsAfterProtocolFees = gains.sub(protocolFeeAmount);
        (uint256 performanceFee, address feeCollector) = account.getPerformanceFee();
        performanceFeeAmount = gainsAfterProtocolFees.mulDown(performanceFee);
        _safeTransfer(token, feeCollector, performanceFeeAmount);
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).safeTransferFrom(from, to, amount);
        }
    }

    function _authenticate(address accountAddress, bytes32[] memory params) internal view returns (Accounts.Data memory account) {
        // Check the given account is the msg.sender, otherwise it will ask the account whether the sender can operate
        // on its behalf. Note that this will never apply for accounts trying to operate on behalf of foreign EOAs.
        account = Accounts.parse(accountAddress);
        bool allowed = account.isSender() || account.canPerform(msg.sender, address(this), msg.sig.toBytes32(), params);
        require(allowed, "ACTION_NOT_ALLOWED");
    }
}
