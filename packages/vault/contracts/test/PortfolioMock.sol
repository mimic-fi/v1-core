// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

import '../interfaces/IPortfolio.sol';

contract PortfolioMock is IPortfolio {
    using SafeMath for uint256;

    struct MockedCanPerformData {
        address who;
        address where;
        bytes32 what;
        bytes how;
    }

    event BeforeDeposit(address sender, address token, uint256 amount, bytes data);
    event AfterDeposit(address sender, address token, uint256 amount, bytes data);
    event BeforeWithdraw(address sender, address token, uint256 amount, address recipient, bytes data);
    event AfterWithdraw(address sender, address token, uint256 amount, address recipient, bytes data);
    event BeforeSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes data);
    event AfterSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes data);
    event BeforeJoin(address sender, address strategy, uint256 amount, bytes data);
    event AfterJoin(address sender, address strategy, uint256 amount, bytes data);
    event BeforeExit(address sender, address strategy, uint256 ratio, bool emergency, bytes data);
    event AfterExit(address sender, address strategy, uint256 ratio, bool emergency, bytes data);

    bool public mockedCanPerform;
    bytes2 public mockedSupportedCallbacks;
    MockedCanPerformData public mockedCanPerformData;

    address public vault;
    uint256 public depositFee;
    uint256 public withdrawFee;
    uint256 public performanceFee;
    address public feeCollector;

    constructor(
        address _vault,
        uint256 _depositFee,
        uint256 _withdrawFee,
        uint256 _performanceFee,
        address _feeCollector
    ) {
        vault = _vault;
        depositFee = _depositFee;
        withdrawFee = _withdrawFee;
        performanceFee = _performanceFee;
        feeCollector = _feeCollector;
    }

    function mockCanPerform(bool newMockedCanPerform) external {
        mockedCanPerform = newMockedCanPerform;
    }

    function mockCanPerformData(MockedCanPerformData memory newMockedCanPerformData) external {
        mockedCanPerformData = newMockedCanPerformData;
    }

    function mockSupportedCallbacks(bytes2 newMockedSupportedCallbacks) external {
        mockedSupportedCallbacks = newMockedSupportedCallbacks;
    }

    function mockApproveTokens(address token, uint256 amount) external {
        IERC20(token).approve(vault, amount);
    }

    function getTokenBalance(address token) external view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getDepositFee(address) external view override returns (uint256 fee, address collector) {
        return (depositFee, feeCollector);
    }

    function getWithdrawFee(address) external view override returns (uint256 fee, address collector) {
        return (withdrawFee, feeCollector);
    }

    function getPerformanceFee(address) external view override returns (uint256 fee, address collector) {
        return (performanceFee, feeCollector);
    }

    function canPerform(address who, address where, bytes32 what, bytes memory how)
        external
        view
        override
        returns (bool)
    {
        MockedCanPerformData memory mocked = mockedCanPerformData;
        if (mocked.who == address(0)) return mockedCanPerform;
        if (mocked.who != who || mocked.where != where || mocked.what != what) return false;
        return keccak256(mocked.how) == keccak256(how);
    }

    function getSupportedCallbacks() external view override returns (bytes2) {
        return mockedSupportedCallbacks;
    }

    function beforeDeposit(address sender, address token, uint256 amount, bytes memory data) external override {
        emit BeforeDeposit(sender, token, amount, data);
    }

    function afterDeposit(address sender, address token, uint256 amount, bytes memory data) external override {
        emit AfterDeposit(sender, token, amount, data);
    }

    function beforeWithdraw(address sender, address token, uint256 amount, address recipient, bytes memory data)
        external
        override
    {
        emit BeforeWithdraw(sender, token, amount, recipient, data);
    }

    function afterWithdraw(address sender, address token, uint256 amount, address recipient, bytes memory data)
        external
        override
    {
        emit AfterWithdraw(sender, token, amount, recipient, data);
    }

    function beforeSwap(
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external override {
        emit BeforeSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
    }

    function afterSwap(
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external override {
        emit AfterSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
    }

    function beforeJoin(address sender, address strategy, uint256 amount, bytes memory data) external override {
        emit BeforeJoin(sender, strategy, amount, data);
    }

    function afterJoin(address sender, address strategy, uint256 amount, bytes memory data) external override {
        emit AfterJoin(sender, strategy, amount, data);
    }

    function beforeExit(address sender, address strategy, uint256 ratio, bool emergency, bytes memory data)
        external
        override
    {
        emit BeforeExit(sender, strategy, ratio, emergency, data);
    }

    function afterExit(address sender, address strategy, uint256 ratio, bool emergency, bytes memory data)
        external
        override
    {
        emit AfterExit(sender, strategy, ratio, emergency, data);
    }
}
