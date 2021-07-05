// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/ISwapConnector.sol";

import "../helpers/FixedPoint.sol";

contract SwapConnectorMock is ISwapConnector {
    using FixedPoint for uint256;

    uint256 public rate;

    constructor() {
        // always used as OUT priced based on IN: 2 means 1 IN is equal to 2 OUT
        rate = FixedPoint.ONE;
    }

    function getAmountOut(address, address, uint256 amountIn) public view override returns (uint256) {
        return amountIn.mul(rate);
    }

    function swap(address /* tokenIn */, address tokenOut, uint256 amountIn, uint256, uint256, bytes memory)
        external
        override
        returns (uint256)
    {
        uint256 amount = amountIn.mul(rate);
        IERC20(tokenOut).approve(msg.sender, amount);
        return amount;
    }

    function mockRate(uint256 newRate) external {
        rate = newRate;
    }
}
