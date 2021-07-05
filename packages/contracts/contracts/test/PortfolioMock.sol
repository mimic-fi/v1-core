// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IPortfolio.sol";

import "../helpers/FixedPoint.sol";

contract PortfolioMock is IPortfolio {
    bool public mockedCanPerform;

    address public vault;
    uint256 public depositFee;
    uint256 public performanceFee;
    address public feeCollector;

    constructor(address _vault, uint256 _depositFee, uint256 _performanceFee, address _feeCollector) {
        vault = _vault;
        depositFee = _depositFee;
        performanceFee = _performanceFee;
        feeCollector = _feeCollector;
    }

    function mockCanPerform(bool newMockedCanPerform) external {
        mockedCanPerform = newMockedCanPerform;
    }

    function getPerformanceFee() external override view returns (uint256 fee, address collector) {
        return (performanceFee, feeCollector);
    }

    function getDepositFee() external override view returns (uint256 fee, address collector) {
        return (depositFee, feeCollector);
    }

    function canPerform(address, address, bytes32, bytes32[] memory) external override view returns (bool) {
        return mockedCanPerform;
    }

    function approveTokens(address[] memory tokens) external override {
        for(uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(vault, FixedPoint.MAX_UINT256);
        }
    }
}
