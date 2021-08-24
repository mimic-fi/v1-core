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

interface IPortfolio {
    event FeesConfigSet(uint256 depositFee, uint256 performanceFee, address feeCollector);

    /**
     * @dev Supported callbacks are a 8-bit map with the following structure:
     * - Least significant bit #0: before deposit
     * - Least significant bit #1: after deposit
     * - Least significant bit #2: before withdraw
     * - Least significant bit #3: after withdraw
     * - Least significant bit #4: before swap
     * - Least significant bit #5: after swap
     * - Least significant bit #6: before join
     * - Least significant bit #7: after join
     * - Least significant bit #8: before exit
     * - Least significant bit #9: after exit
     * - Remaining most significant 6 bits are ignored
     *
     * For example, if a Portfolio supports "before join" and "after exit" it should respond "1001000000" (0x240).
     */
    function getSupportedCallbacks() external view returns (bytes2);

    function getPerformanceFee() external view returns (uint256 fee, address collector);

    function getDepositFee() external view returns (uint256 fee, address collector);

    function canPerform(address who, address where, bytes32 what, bytes32[] memory how) external view returns (bool);

    function beforeDeposit(address sender, address[] memory tokens, uint256[] memory amounts) external;

    function afterDeposit(address sender, address[] memory tokens, uint256[] memory amounts) external;

    function beforeWithdraw(address sender, address[] memory tokens, uint256[] memory amounts, address recipient) external;

    function afterWithdraw(address sender, address[] memory tokens, uint256[] memory amounts, address recipient) external;

    function beforeSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) external;

    function afterSwap(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) external;

    function beforeJoin(address sender, address strategy, uint256 amount, bytes memory data) external;

    function afterJoin(address sender, address strategy, uint256 amount, bytes memory data) external;

    function beforeExit(address sender, address strategy, uint256 ratio, bytes memory data) external;

    function afterExit(address sender, address strategy, uint256 ratio, bytes memory data) external;
}
