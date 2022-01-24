// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/ISwapConnector.sol';

import '../libraries/FixedPoint.sol';

contract SwapConnectorMock is ISwapConnector {
    using FixedPoint for uint256;

    uint256 public mockedRate;

    constructor() {
        // always used as OUT priced based on IN: 2 means 1 IN is equal to 2 OUT
        mockedRate = FixedPoint.ONE;
    }

    function getAmountOut(address, address, uint256 amountIn) public view override returns (uint256) {
        return amountIn.mulDown(mockedRate);
    }

    function swap(address, address tokenOut, uint256 amountIn, uint256, uint256, bytes memory)
        external
        override
        returns (uint256 remainingIn, uint256 amountOut)
    {
        remainingIn = 0;
        amountOut = amountIn.mulDown(mockedRate);
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }

    function mockRate(uint256 newRate) external {
        mockedRate = newRate;
    }
}
