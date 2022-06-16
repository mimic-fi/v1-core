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

pragma solidity >=0.8.0;

/**
 * @title ISwapConnector
 * @dev Mimic's Vault relies on a connector used to interact with AMMs. This allows Mimic to update the swap logic
 *      without having to update the Vault. It is mainly used to allow users swapping their tokens, but it is also
 *      used by many strategies to swap their earned rewards in order to reinvest them or calculate minimum amounts when entering or exiting instruments.
 */
interface ISwapConnector {
    /**
     * @dev Quotes the amount out for a swap
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of tokenIn being swapped
     * @custom:deprecated This method will be deprecated
     */
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);

    /**
     * @dev Swaps two tokens
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of tokenIn being swapped
     * @param minAmountOut Minimum amount of tokenOut willing to receive
     * @param deadline Expiration timestamp to be used for the swap request
     * @param data Arbitrary extra data
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes memory data
    ) external returns (uint256 remainingIn, uint256 amountOut);
}
