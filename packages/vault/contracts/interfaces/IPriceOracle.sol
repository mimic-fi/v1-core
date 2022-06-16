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
 * @title IPriceOracle
 * @dev Mimic's Vault relies on an external price oracle used to compute expected amounts out before committing swaps,
 *      it is mainly used with the SwapConnector (see ISwapConnector). Additionally, there are many strategies that
 *      rely on the price oracle as well since these need to swap their earned rewards in order to reinvest them or calculate minimum amounts when entering or exiting instruments.
 */
interface IPriceOracle {
    /**
     * @dev The returned value is expected to be the price of `token` expressed in `quote`.
     * Moreover, since `token` and `quote` may not use the same decimal value, the returned value is expected
     * to be expressed using a number of decimals such as when performing a fixed point product of it by a
     * `quote` amount it results in a value expressed in `token` decimals. For example, if `token` is USDC and
     * `quote` is ETH, then the returned value is expected to be expressed using 6 decimals.
     *
     * FixedPoint.mul(X[ETH], price[USDC/ETH]) =  FixedPoint.mul(X[18], price[6]) = X * price [6]
     */
    function getTokenPrice(address token, address quote) external view returns (uint256);
}
