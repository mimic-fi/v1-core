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

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";

import "../interfaces/ISwapConnector.sol";

contract UniswapConnector is ISwapConnector {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IUniswapV2Router01 public immutable uniswap;

    constructor(IUniswapV2Router01 _uniswap) {
        uniswap = _uniswap;
    }

    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view override returns (uint256) {
        (uint256 reserve0, uint256 reserve1,) = _getPool(tokenIn, tokenOut).getReserves();
        require(reserve0 > 0 && reserve1 > 0, "UNISWAP_POOL_NOT_INITIALIZED");
        bool isTokenIn0 = tokenIn < tokenOut;
        uint256 reserveIn = isTokenIn0 ? reserve0 : reserve1;
        uint256 reserveOut = isTokenIn0 ? reserve1 : reserve0;
        return uniswap.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes memory /* data */
    ) external override returns (uint256, uint256) {
        IERC20(tokenIn).safeApprove(address(uniswap), amountIn);
        address[] memory path = _path(tokenIn, tokenOut);
        uint256[] memory amounts = uniswap.swapExactTokensForTokens(amountIn, minAmountOut, path, msg.sender, deadline);
        require(amounts.length == 2, "UNISWAP_INVALID_RESPONSE_LENGTH");
        return (amounts[0], amounts[1]);
    }

    function _getPool(address tokenA, address tokenB) internal view returns (IUniswapV2Pair) {
        IUniswapV2Factory factory = IUniswapV2Factory(uniswap.factory());
        address pool = factory.getPair(tokenA, tokenB);
        require(pool != address(0), "UNISWAP_POOL_NOT_CREATED");
        return IUniswapV2Pair(pool);
    }

    function _path(address tokenA, address tokenB) internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }
}
