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

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import './libraries/Accounts.sol';
import './libraries/FixedPoint.sol';
import './libraries/VaultQuery.sol';
import './libraries/VaultHelpers.sol';

import './interfaces/IPriceOracle.sol';
import './interfaces/IStrategy.sol';
import './interfaces/ISwapConnector.sol';
import './interfaces/IVault.sol';

contract Vault is IVault, Ownable, ReentrancyGuard, VaultQuery {
    using SafeERC20 for IERC20;
    using FixedPoint for uint256;
    using VaultHelpers for bytes;
    using BytesHelpers for bytes4;
    using Accounts for Accounts.Data;

    uint256 public constant override EXIT_RATIO_PRECISION = 1e18;

    uint256 internal constant MAX_SLIPPAGE = 2e17; // 20%
    uint256 internal constant MAX_PROTOCOL_FEE = 2e17; // 20%

    struct Accounting {
        mapping (address => uint256) balance;
        mapping (address => uint256) shares;
        mapping (address => uint256) invested;
    }

    uint256 public immutable override maxSlippage;

    uint256 public override protocolFee;
    address public override priceOracle;
    address public override swapConnector;
    mapping (address => bool) public override isTokenWhitelisted;
    mapping (address => bool) public override isStrategyWhitelisted;
    mapping (address => uint256) public override getStrategyShares;

    uint256 public lastAccountId;
    mapping (address => uint256) public accountsId;
    mapping (uint256 => Accounting) internal accountings;

    constructor(
        uint256 _maxSlippage,
        uint256 _protocolFee,
        address _priceOracle,
        address _swapConnector,
        address[] memory _whitelistedTokens,
        address[] memory _whitelistedStrategies
    ) {
        require(_maxSlippage <= MAX_SLIPPAGE, 'MAX_SLIPPAGE_TOO_HIGH');
        maxSlippage = _maxSlippage;

        setProtocolFee(_protocolFee);
        setPriceOracle(_priceOracle);
        setSwapConnector(_swapConnector);
        setWhitelistedTokens(_whitelistedTokens, VaultHelpers.trues(_whitelistedTokens.length));
        setWhitelistedStrategies(_whitelistedStrategies, VaultHelpers.trues(_whitelistedStrategies.length));
    }

    function getAccountBalance(address addr, address token) external view override returns (uint256) {
        Accounting storage accounting = accountings[accountsId[addr]];
        return accounting.balance[token];
    }

    function getAccountInvestment(address addr, address strategy)
        external
        view
        override
        returns (uint256 invested, uint256 shares)
    {
        Accounting storage accounting = accountings[accountsId[addr]];
        invested = accounting.invested[strategy];
        shares = accounting.shares[strategy];
    }

    function getAccountCurrentValue(address addr, address strategy) external view override returns (uint256) {
        Accounting storage accounting = accountings[accountsId[addr]];
        uint256 accountShares = accounting.shares[strategy];
        if (accountShares == 0) return 0;

        uint256 totalShares = getStrategyShares[strategy];
        uint256 totalValue = IStrategy(strategy).getTotalValue();
        return totalValue.mulDown(accountShares).divDown(totalShares);
    }

    function getStrategyShareValue(address strategy) external view override returns (uint256) {
        uint256 totalShares = getStrategyShares[strategy];
        uint256 totalValue = IStrategy(strategy).getTotalValue();
        return totalValue.divDown(totalShares);
    }

    function query(bytes[] memory data, bool[] memory readsOutput)
        public
        override(IVault, VaultQuery)
        returns (bytes[] memory results)
    {
        return VaultQuery.query(data, readsOutput);
    }

    function setProtocolFee(uint256 newProtocolFee) public override nonReentrant onlyOwner {
        require(newProtocolFee <= MAX_PROTOCOL_FEE, 'PROTOCOL_FEE_TOO_HIGH');
        protocolFee = newProtocolFee;
        emit ProtocolFeeSet(newProtocolFee);
    }

    function setPriceOracle(address newPriceOracle) public override nonReentrant onlyOwner {
        require(newPriceOracle != address(0), 'PRICE_ORACLE_ZERO_ADDRESS');
        priceOracle = newPriceOracle;
        emit PriceOracleSet(newPriceOracle);
    }

    function setSwapConnector(address newSwapConnector) public override nonReentrant onlyOwner {
        require(newSwapConnector != address(0), 'SWAP_CONNECTOR_ZERO_ADDRESS');
        swapConnector = newSwapConnector;
        emit SwapConnectorSet(newSwapConnector);
    }

    function setWhitelistedTokens(address[] memory tokens, bool[] memory whitelisted)
        public
        override
        nonReentrant
        onlyOwner
    {
        require(tokens.length == whitelisted.length, 'INVALID_WHITELISTED_LENGTH');
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), 'TOKEN_ZERO_ADDRESS');
            isTokenWhitelisted[token] = whitelisted[i];
            emit WhitelistedTokenSet(token, whitelisted[i]);
        }
    }

    function setWhitelistedStrategies(address[] memory strategies, bool[] memory whitelisted)
        public
        override
        nonReentrant
        onlyOwner
    {
        require(strategies.length == whitelisted.length, 'INVALID_WHITELISTED_LENGTH');
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            require(strategy != address(0), 'STRATEGY_ZERO_ADDRESS');
            isStrategyWhitelisted[strategy] = whitelisted[i];
            emit WhitelistedStrategySet(strategy, whitelisted[i]);
        }
    }

    function batch(bytes[] memory data, bool[] memory readsOutput) external override returns (bytes[] memory results) {
        require(readsOutput.length == data.length || readsOutput.length == 0, 'BATCH_INVALID_READS_OUTPUT_VALUE');
        bool requiresOutput = readsOutput.length == data.length;
        results = new bytes[](data.length);

        for (uint256 i = 0; i < data.length; i++) {
            bool shouldPopulateWithPreviousOutput = i > 0 && requiresOutput && readsOutput[i];
            if (shouldPopulateWithPreviousOutput) data[i].populateWithPreviousOutput(data[i - 1], results[i - 1]);
            results[i] = Address.functionDelegateCall(address(this), data[i]);
        }
    }

    function migrate(address addr, address to, bytes memory data) external override nonReentrant {
        Accounts.Data memory account = _authorize(addr, abi.encode(to, data));
        account.beforeMigrate(msg.sender, to, data);
        _migrate(account, to, data);
        account.afterMigrate(msg.sender, to, data);
    }

    function deposit(address addr, address token, uint256 amount, bytes memory data)
        external
        override
        nonReentrant
        returns (uint256 deposited)
    {
        Accounts.Data memory account = _authorize(addr, abi.encode(token, amount, data));
        account.beforeDeposit(msg.sender, token, amount, data);
        deposited = _deposit(account, token, amount, data);
        account.afterDeposit(msg.sender, token, amount, data);
    }

    function withdraw(address addr, address token, uint256 amount, address recipient, bytes memory data)
        external
        override
        nonReentrant
        returns (uint256 withdrawn)
    {
        Accounts.Data memory account = _authorize(addr, abi.encode(token, amount, recipient, data));
        account.beforeWithdraw(msg.sender, token, amount, recipient, data);
        withdrawn = _withdraw(account, token, amount, recipient, data);
        account.afterWithdraw(msg.sender, token, amount, recipient, data);
    }

    function swap(
        address addr,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external override nonReentrant returns (uint256 amountOut) {
        Accounts.Data memory account = _authorize(addr, abi.encode(tokenIn, tokenOut, amountIn, slippage, data));
        account.beforeSwap(msg.sender, tokenIn, tokenOut, amountIn, slippage, data);
        amountOut = _swap(account, tokenIn, tokenOut, amountIn, slippage, data);
        account.afterSwap(msg.sender, tokenIn, tokenOut, amountIn, slippage, data);
    }

    function join(address addr, address strategy, uint256 amount, bytes memory data)
        external
        override
        nonReentrant
        returns (uint256 shares)
    {
        Accounts.Data memory account = _authorize(addr, abi.encode(strategy, amount, data));
        account.beforeJoin(msg.sender, strategy, amount, data);
        shares = _join(account, strategy, amount, data);
        account.afterJoin(msg.sender, strategy, amount, data);
    }

    function exit(address addr, address strategy, uint256 ratio, bool emergency, bytes memory data)
        external
        override
        nonReentrant
        returns (uint256 received)
    {
        Accounts.Data memory account = _authorize(addr, abi.encode(strategy, ratio, emergency, data));
        account.beforeExit(msg.sender, strategy, ratio, emergency, data);
        received = _exit(account, strategy, ratio, emergency, data);
        account.afterExit(msg.sender, strategy, ratio, emergency, data);
    }

    function _migrate(Accounts.Data memory account, address to, bytes memory data) internal {
        require(accountsId[to] == 0, 'TARGET_ALREADY_INITIALIZED');
        accountsId[to] = account.id;
        accountsId[account.addr] = 0;
        emit Migrate(account.addr, to, data);
    }

    function _deposit(Accounts.Data memory account, address token, uint256 amount, bytes memory data)
        internal
        returns (uint256 deposited)
    {
        require(amount > 0, 'DEPOSIT_AMOUNT_ZERO');

        (uint256 depositFee, address feeCollector) = account.getDepositFee(token);
        _safeTransferFrom(token, account.addr, address(this), amount);

        uint256 depositFeeAmount = amount.mulDown(depositFee);
        _safeTransfer(token, feeCollector, depositFeeAmount);

        deposited = amount.sub(depositFeeAmount);
        Accounting storage accounting = accountings[account.id];
        accounting.balance[token] = accounting.balance[token].add(deposited);
        emit Deposit(account.addr, token, amount, depositFeeAmount, data);
    }

    function _withdraw(
        Accounts.Data memory account,
        address token,
        uint256 amount,
        address recipient,
        bytes memory data
    ) internal returns (uint256 withdrawn) {
        require(amount > 0, 'WITHDRAW_AMOUNT_ZERO');

        Accounting storage accounting = accountings[account.id];
        uint256 vaultBalance = accounting.balance[token];
        uint256 portfolioBalance = account.getTokenBalance(token);
        require(vaultBalance.add(portfolioBalance) >= amount, 'ACCOUNTING_INSUFFICIENT_BALANCE');

        uint256 fromAccount = Math.min(portfolioBalance, amount);
        _safeTransferFrom(token, account.addr, recipient, fromAccount);

        uint256 fromVault;
        uint256 withdrawFeeAmount;
        // scopes to avoid stack too deep
        {
            (uint256 withdrawFee, address feeCollector) = account.getWithdrawFee(token);
            fromVault = fromAccount < amount ? amount - fromAccount : 0;
            withdrawFeeAmount = fromVault.mulDown(withdrawFee);
            _safeTransfer(token, feeCollector, withdrawFeeAmount);
            _safeTransfer(token, recipient, fromVault.sub(withdrawFeeAmount));
        }
        accounting.balance[token] = vaultBalance.sub(fromVault);
        withdrawn = amount.sub(withdrawFeeAmount);
        emit Withdraw(account.addr, token, amount, fromVault, withdrawFeeAmount, recipient, data);
    }

    function _swap(
        Accounts.Data memory account,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) internal returns (uint256 amountOut) {
        require(tokenIn != tokenOut, 'SWAP_SAME_TOKEN');
        require(slippage <= maxSlippage, 'SWAP_MAX_SLIPPAGE');

        Accounting storage accounting = accountings[account.id];
        uint256 currentBalance = accounting.balance[tokenIn];
        require(currentBalance >= amountIn, 'ACCOUNTING_INSUFFICIENT_BALANCE');

        uint256 remainingIn;
        uint256 minAmountOut;
        ISwapConnector connector = ISwapConnector(swapConnector);
        // scopes to avoid stack too deep
        {
            uint256 price = IPriceOracle(priceOracle).getTokenPrice(tokenOut, tokenIn);
            minAmountOut = amountIn.mulUp(price).mulUp(FixedPoint.ONE - slippage);
            require(connector.getAmountOut(tokenIn, tokenOut, amountIn) >= minAmountOut, 'EXPECTED_SWAP_MIN_AMOUNT');
        }
        {
            _safeTransfer(tokenIn, swapConnector, amountIn);
            uint256 preBalanceIn = IERC20(tokenIn).balanceOf(address(this));
            uint256 preBalanceOut = IERC20(tokenOut).balanceOf(address(this));
            (remainingIn, amountOut) = connector.swap(tokenIn, tokenOut, amountIn, minAmountOut, block.timestamp, data);

            uint256 postBalanceIn = IERC20(tokenIn).balanceOf(address(this));
            require(postBalanceIn >= preBalanceIn.add(remainingIn), 'SWAP_INVALID_REMAINING_IN');

            uint256 postBalanceOut = IERC20(tokenOut).balanceOf(address(this));
            require(amountOut >= minAmountOut, 'SWAP_MIN_AMOUNT');
            require(postBalanceOut >= preBalanceOut.add(amountOut), 'SWAP_INVALID_AMOUNT_OUT');
        }

        accounting.balance[tokenIn] = currentBalance.sub(amountIn).add(remainingIn);
        accounting.balance[tokenOut] = accounting.balance[tokenOut].add(amountOut);
        emit Swap(account.addr, tokenIn, tokenOut, amountIn, remainingIn, amountOut, data);
    }

    function _join(Accounts.Data memory account, address strategy, uint256 amount, bytes memory data)
        internal
        returns (uint256 shares)
    {
        require(amount > 0, 'JOIN_AMOUNT_ZERO');

        address token = IStrategy(strategy).getToken();
        Accounting storage accounting = accountings[account.id];
        uint256 currentBalance = accounting.balance[token];
        require(currentBalance >= amount, 'ACCOUNTING_INSUFFICIENT_BALANCE');
        accounting.balance[token] = currentBalance.sub(amount);

        _safeTransfer(token, strategy, amount);
        (uint256 value, uint256 totalValue) = IStrategy(strategy).onJoin(amount, data);

        uint256 totalShares = getStrategyShares[strategy];
        shares = totalShares == 0 ? value : value.mulDown(totalShares).divDown(totalValue.sub(value));
        getStrategyShares[strategy] = totalShares.add(shares);

        accounting.shares[strategy] = accounting.shares[strategy].add(shares);
        accounting.invested[strategy] = accounting.invested[strategy].add(value);
        emit Join(account.addr, strategy, amount, data);
    }

    function _exit(Accounts.Data memory account, address strategy, uint256 ratio, bool emergency, bytes memory data)
        internal
        returns (uint256 received)
    {
        require(ratio > 0 && ratio <= FixedPoint.ONE, 'INVALID_EXIT_RATIO');

        address token;
        uint256 amount;
        uint256 exitingValue;
        uint256 currentValue;
        Accounting storage accounting = accountings[account.id];
        // scope to avoid stack too deep
        {
            uint256 currentShares = accounting.shares[strategy];
            uint256 exitingShares = currentShares.mulDown(ratio);
            require(exitingShares > 0, 'EXIT_SHARES_ZERO');
            require(currentShares >= exitingShares, 'ACCOUNT_INSUFFICIENT_SHARES');

            uint256 totalShares = getStrategyShares[strategy];
            accounting.shares[strategy] = currentShares - exitingShares;
            getStrategyShares[strategy] = exitingShares >= totalShares ? 0 : totalShares - exitingShares;

            uint256 totalValue;
            (token, amount, exitingValue, totalValue) = IStrategy(strategy).onExit(
                SafeMath.mul(exitingShares, EXIT_RATIO_PRECISION).divDown(totalShares),
                emergency,
                data
            );

            _safeTransferFrom(token, strategy, address(this), amount);
            currentValue = totalValue.add(exitingValue).mulDown(currentShares).divDown(totalShares);
        }

        uint256 investedValue = accounting.invested[strategy];
        (uint256 protocolFeeAmount, uint256 performanceFeeAmount) = _payExitFees(
            account,
            strategy,
            token,
            amount,
            exitingValue,
            investedValue,
            currentValue
        );

        received = amount.sub(protocolFeeAmount).sub(performanceFeeAmount);
        accounting.balance[token] = accounting.balance[token].add(received);
        accounting.invested[strategy] = investedValue >= currentValue
            ? investedValue.mulUp(FixedPoint.ONE.sub(ratio))
            : Math.min(investedValue, exitingValue >= currentValue ? 0 : currentValue - exitingValue);

        emit Exit(account.addr, strategy, amount, protocolFeeAmount, performanceFeeAmount, data);
    }

    function _payExitFees(
        Accounts.Data memory account,
        address strategy,
        address token,
        uint256 amount,
        uint256 exitingValue,
        uint256 investedValue,
        uint256 currentValue
    ) private returns (uint256 protocolFeeAmount, uint256 performanceFeeAmount) {
        if (investedValue >= currentValue) {
            return (0, 0);
        }

        uint256 valueGains = currentValue - investedValue;
        // `tokenGains` won't be greater than `amount`
        uint256 tokenGains = valueGains > exitingValue ? amount : amount.mulDown(valueGains).divDown(exitingValue);
        protocolFeeAmount = tokenGains.mulDown(protocolFee);
        _safeTransfer(token, owner(), protocolFeeAmount);

        uint256 tokenGainsAfterProtocolFees = tokenGains.sub(protocolFeeAmount);
        (uint256 performanceFee, address feeCollector) = account.getPerformanceFee(strategy);
        performanceFeeAmount = tokenGainsAfterProtocolFees.mulDown(performanceFee);
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

    function _authorize(address addr, bytes memory params) internal returns (Accounts.Data memory account) {
        // Initialize account, assign an ID if it's the first time operating
        uint256 accountId = accountsId[addr];
        if (accountId == 0) {
            accountId = ++lastAccountId;
            accountsId[addr] = accountId;
        }

        // Check the given account is the msg.sender, otherwise it will ask the account whether the sender can operate
        // on its behalf. Note that this will never apply for accounts trying to operate on behalf of foreign EOAs.
        account = Accounts.parse(addr, accountId);
        bool allowed = account.isSender() || account.canPerform(msg.sender, address(this), msg.sig.toBytes32(), params);
        require(allowed, 'ACTION_NOT_ALLOWED');
    }
}
