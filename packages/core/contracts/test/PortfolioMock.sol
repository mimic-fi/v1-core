// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../libraries/FixedPoint.sol";

import "../interfaces/IPortfolio.sol";

contract PortfolioMock is IPortfolio {
    using SafeMath for uint256;

    event BeforeDeposit(address sender, address token, uint256 amount);
    event AfterDeposit(address sender, address token, uint256 amount);
    event BeforeWithdraw(address sender, address token, uint256 amount, address recipient);
    event AfterWithdraw(address sender, address token, uint256 amount, address recipient);
    event BeforeSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes data);
    event AfterSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes data);
    event BeforeJoin(address sender, address strategy, uint256 amount, bytes data);
    event AfterJoin(address sender, address strategy, uint256 amount, bytes data);
    event BeforeExit(address sender, address strategy, uint256 ratio, bytes data);
    event AfterExit(address sender, address strategy, uint256 ratio, bytes data);

    bool public mockedCanPerform;
    bytes2 public mockedSupportedCallbacks;

    address public vault;
    uint256 public depositFee;
    uint256 public withdrawFee;
    uint256 public performanceFee;
    address public feeCollector;

    constructor(address _vault, uint256 _depositFee, uint256 _withdrawFee, uint256 _performanceFee, address _feeCollector) {
        vault = _vault;
        depositFee = _depositFee;
        withdrawFee = _withdrawFee;
        performanceFee = _performanceFee;
        feeCollector = _feeCollector;
    }

    function mockCanPerform(bool newMockedCanPerform) external {
        mockedCanPerform = newMockedCanPerform;
    }

    function mockSupportedCallbacks(bytes2 newMockedSupportedCallbacks) external {
        mockedSupportedCallbacks = newMockedSupportedCallbacks;
    }

    function mockApproveTokens(address token, uint256 amount) external {
        IERC20(token).approve(vault, amount);
    }

    function getDepositFee() external override view returns (uint256 fee, address collector) {
        return (depositFee, feeCollector);
    }

    function getWithdrawFee() external override view returns (uint256 fee, address collector) {
        return (withdrawFee, feeCollector);
    }

    function getPerformanceFee() external override view returns (uint256 fee, address collector) {
        return (performanceFee, feeCollector);
    }

    function canPerform(address, address, bytes32, bytes32[] memory) external override view returns (bool) {
        return mockedCanPerform;
    }

    function getSupportedCallbacks() external override view returns (bytes2) {
        return mockedSupportedCallbacks;
    }

    function beforeDeposit(address sender, address token, uint256 amount) external override {
        emit BeforeDeposit(sender, token, amount);
    }

    function afterDeposit(address sender, address token, uint256 amount) external override {
        emit AfterDeposit(sender, token, amount);
    }

    function beforeWithdraw(address sender, address token, uint256 amount, address recipient) external override {
        emit BeforeWithdraw(sender, token, amount, recipient);
    }

    function afterWithdraw(address sender, address token, uint256 amount, address recipient) external override {
        emit AfterWithdraw(sender, token, amount, recipient);
    }

    function beforeSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) external override {
        emit BeforeSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
    }

    function afterSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) external override {
        emit AfterSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
    }

    function beforeJoin(address sender, address strategy, uint256 amount, bytes memory data) external override {
        emit BeforeJoin(sender, strategy, amount, data);
    }

    function afterJoin(address sender, address strategy, uint256 amount, bytes memory data) external override {
        emit AfterJoin(sender, strategy, amount, data);
    }

    function beforeExit(address sender, address strategy, uint256 ratio, bytes memory data) external override {
        emit BeforeExit(sender, strategy, ratio, data);
    }

    function afterExit(address sender, address strategy, uint256 ratio, bytes memory data) external override {
        emit AfterExit(sender, strategy, ratio, data);
    }
}
