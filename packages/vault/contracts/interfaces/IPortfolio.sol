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
 * @title IPortfolio
 * @dev Wallet interface required by Mimic's Vault
 */
interface IPortfolio {
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
     * - Least significant bit #10: before migrate
     * - Least significant bit #11: after migrate
     * - Remaining most significant 6 bits are ignored
     *
     * For example, if a Wallet supports 'before join' and 'after exit' it should respond '001001000000' (0x240).
     */
    function getSupportedCallbacks() external view returns (bytes2);

    /**
     * @dev Tells the token balance of the wallet
     * @param token Address of the token being queried
     */
    function getTokenBalance(address token) external view returns (uint256);

    /**
     * @dev Tells the deposit fee configured in the wallet
     * @param token Address of the token being deposited
     */
    function getDepositFee(address token) external view returns (uint256 fee, address collector);

    /**
     * @dev Tells the withdraw fee configured in the wallet
     * @param token Address of the token being withdrawn
     */
    function getWithdrawFee(address token) external view returns (uint256 fee, address collector);

    /**
     * @dev Tells the performance fee configured in the wallet
     * @param strategy Address of the strategy interacted with
     */
    function getPerformanceFee(address strategy) external view returns (uint256 fee, address collector);

    /**
     * @dev Tells if a certain action is allowed by the wallet
     * @param who Who is trying to perform the action
     * @param where What's the contract being called to perform the action
     * @param what What's the action being performed
     * @param how The details of the action being performed
     */
    function canPerform(address who, address where, bytes32 what, bytes memory how) external view returns (bool);

    /**
     * @dev Before deposit callback
     * @param sender Account calling the deposit action
     * @param token Address of the token to be deposited
     * @param amount Amount of tokens to be deposited
     * @param data Arbitrary extra data
     */
    function beforeDeposit(address sender, address token, uint256 amount, bytes memory data) external;

    /**
     * @dev After deposit callback
     * @param sender Account calling the deposit action
     * @param token Address of the token to be deposited
     * @param amount Amount of tokens to be deposited
     * @param data Arbitrary extra data
     */
    function afterDeposit(address sender, address token, uint256 amount, bytes memory data) external;

    /**
     * @dev Before withdraw callback
     * @param sender Account calling the withdraw action
     * @param token Address of the token to be withdrawn
     * @param amount Amount of tokens to be withdrawn
     * @param recipient Address where the tokens are being transferred
     * @param data Arbitrary extra data
     */
    function beforeWithdraw(address sender, address token, uint256 amount, address recipient, bytes memory data)
        external;

    /**
     * @dev After withdraw callback
     * @param sender Account calling the withdraw action
     * @param token Address of the token to be withdrawn
     * @param amount Amount of tokens to be withdrawn
     * @param recipient Address where the tokens are being transferred
     * @param data Arbitrary extra data
     */
    function afterWithdraw(address sender, address token, uint256 amount, address recipient, bytes memory data)
        external;

    /**
     * @dev Before swap callback
     * @param sender Account calling the swap action
     * @param tokenIn Token to be sent
     * @param tokenOut Token to receive
     * @param amountIn Amount of tokenIn to be swapped
     * @param slippage Accepted slippage for the swap
     * @param data Arbitrary extra data
     */
    function beforeSwap(
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external;

    /**
     * @dev After swap callback
     * @param sender Account calling the swap action
     * @param tokenIn Token to be sent
     * @param tokenOut Token to receive
     * @param amountIn Amount of tokenIn to be swapped
     * @param slippage Accepted slippage for the swap
     * @param data Arbitrary extra data
     */
    function afterSwap(
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external;

    /**
     * @dev Before join callback
     * @param sender Account calling the join action
     * @param strategy Strategy to be joined
     * @param amount Amount of strategy tokens to join with
     * @param data Arbitrary extra data
     */
    function beforeJoin(address sender, address strategy, uint256 amount, bytes memory data) external;

    /**
     * @dev After join callback
     * @param sender Account calling the join action
     * @param strategy Strategy to be joined
     * @param amount Amount of strategy tokens to join with
     * @param data Arbitrary extra data
     */
    function afterJoin(address sender, address strategy, uint256 amount, bytes memory data) external;

    /**
     * @dev Before exit callback
     * @param sender Account calling the exit action
     * @param strategy Strategy to be exited
     * @param ratio Ratio of shares to exit with
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     */
    function beforeExit(address sender, address strategy, uint256 ratio, bool emergency, bytes memory data) external;

    /**
     * @dev After exit callback
     * @param sender Account calling the exit action
     * @param strategy Strategy to be exited
     * @param ratio Ratio of shares to exit with
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     */
    function afterExit(address sender, address strategy, uint256 ratio, bool emergency, bytes memory data) external;

    /**
     * @dev Before migrate callback
     * @param sender Account calling the migrate action
     * @param to Address of the account migrating to
     * @param data Arbitrary extra data
     */
    function beforeMigrate(address sender, address to, bytes memory data) external;

    /**
     * @dev After migrate callback
     * @param sender Account calling the migrate action
     * @param to Address of the account migrating to
     * @param data Arbitrary extra data
     */
    function afterMigrate(address sender, address to, bytes memory data) external;
}
