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

import './BytesHelpers.sol';

import '../interfaces/IVault.sol';

/**
 * @title VaultHelpers
 * @dev Helpers used internally by Mimic's Vault mainly to operate with calldata
 */
library VaultHelpers {
    using BytesHelpers for bytes;
    using BytesHelpers for bytes32;

    /**
     * @dev Internal struct to encode the calldata of a migrate action
     * @param to Address of the account migrating to
     * @param data Arbitrary extra data
     */
    struct MigrateParams {
        address to;
        bytes data;
    }

    /** 
     * @dev Internal struct to encode the calldata of a deposit action
     * @param token Address of the token being deposited
     * @param amount Amount of tokens being deposited
     * @param data Arbitrary data
     */
    struct DepositParams {
        address token;
        uint256 amount;
        bytes data;
    }

    /**
     * @dev Internal struct to encode the calldata of a withdraw action
     * @param token Address of the token to be withdrawn
     * @param amount Amount of tokens to be withdrawn
     * @param recipient Address where the tokens are being transferred to
     * @param data Arbitrary extra data
     */
    struct WithdrawParams {
        address token;
        uint256 amount;
        address recipient;
        bytes data;
    }

    /**
     * @dev Internal struct to encode the calldata of a swap action
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of tokenIn to be swapped
     * @param slippage Accepted slippage for the swap
     * @param data Arbitrary extra data
     */
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 slippage;
        bytes data;
    }

    /**
     * @dev Internal struct to encode the calldata of a join action
     * @param strategy Strategy to be joined
     * @param amount Amount of strategy tokens to join with
     * @param data Arbitrary extra data
     */
    struct JoinParams {
        address strategy;
        uint256 amount;
        bytes data;
    }

    /**
     * @dev Internal struct to encode the calldata of an exit action
     * @param strategy Strategy to be exited
     * @param ratio Ratio of shares to exit with
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     */
    struct ExitParams {
        address strategy;
        uint256 ratio;
        bool emergency;
        bytes data;
    }

    /**
     * @dev Decodes a bytes array into the expected calldata value of a migrate action
     */
    function decodeMigrate(bytes memory self) internal pure returns (MigrateParams memory) {
        (address to, bytes memory data) = abi.decode(self, (address, bytes));
        return MigrateParams({ to: to, data: data });
    }

    /** 
     * @dev Decodes a bytes array into the expected calldata value of a deposit action
     */
    function decodeDeposit(bytes memory self) internal pure returns (DepositParams memory) {
        (address token, uint256 amount, bytes memory data) = abi.decode(self, (address, uint256, bytes));
        return DepositParams({ token: token, amount: amount, data: data });
    }

    /**
     * @dev Decodes a bytes array into the expected calldata value of a withdraw action
     */
    function decodeWithdraw(bytes memory self) internal pure returns (WithdrawParams memory) {
        (address token, uint256 amount, address recipient, bytes memory data) = abi.decode(
            self,
            (address, uint256, address, bytes)
        );
        return WithdrawParams({ token: token, amount: amount, recipient: recipient, data: data });
    }

    /**
     * @dev Decodes a bytes array into the expected calldata value of a swap action
     */
    function decodeSwap(bytes memory self) internal pure returns (SwapParams memory) {
        (address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) = abi.decode(
            self,
            (address, address, uint256, uint256, bytes)
        );
        return SwapParams({ tokenIn: tokenIn, tokenOut: tokenOut, amountIn: amountIn, slippage: slippage, data: data });
    }

    /**
     * @dev Decodes a bytes array into the expected calldata value of a join action
     */
    function decodeJoin(bytes memory self) internal pure returns (JoinParams memory) {
        (address strategy, uint256 amount, bytes memory data) = abi.decode(self, (address, uint256, bytes));
        return JoinParams({ strategy: strategy, amount: amount, data: data });
    }

    /**
     * @dev Decodes a bytes array into the expected calldata value of an exit action
     */
    function decodeExit(bytes memory self) internal pure returns (ExitParams memory) {
        (address strategy, uint256 ratio, bool emergency, bytes memory data) = abi.decode(
            self,
            (address, uint256, bool, bytes)
        );
        return ExitParams({ strategy: strategy, ratio: ratio, emergency: emergency, data: data });
    }

    /**
     * @dev Tells whether the four most significant bytes of a word are equal to the migrate selector
     */
    function isMigrate(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.migrate.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a bytes array are equal to the migrate selector
     */
    function isMigrate(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.migrate.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a word are equal to the deposit selector
     */
    function isDeposit(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.deposit.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a bytes array are equal to the deposit selector
     */
    function isDeposit(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.deposit.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a word are equal to the withdraw selector
     */
    function isWithdraw(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.withdraw.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a bytes array are equal to the withdraw selector
     */
    function isWithdraw(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.withdraw.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a word are equal to the swap selector
     */
    function isSwap(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.swap.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a bytes array are equal to the swap selector
     */
    function isSwap(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.swap.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a word are equal to the join selector
     */
    function isJoin(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.join.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a bytes array are equal to the join selector
     */
    function isJoin(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.join.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a word are equal to the exit selector
     */
    function isExit(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.exit.selector;
    }

    /**
     * @dev Tells whether the four most significant bytes of a bytes array are equal to the exit selector
     */
    function isExit(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.exit.selector;
    }

    /**
     * @dev Builds an array of true booleans
     */
    function trues(uint256 size) internal pure returns (bool[] memory array) {
        array = new bool[](size);
        for (uint256 i = 0; i < size; i++) {
            array[i] = true;
        }
    }

    /**
     * @dev Used internally in `query` and `batch` to populate current calls with the outcome of a previous call
     *      Paths are defined, these cannot be programmed:
     *      1. Deposit => Swap
     *      2. Deposit => Join
     *      3. Deposit => Withdraw
     *      4. Swap => Swap
     *      5. Swap => Join
     *      6. Swap => Withdraw
     *      7. Exit => Swap
     *      8. Exit => Join
     *      9. Exit => Withdraw
     *      Note that joins, withdraws, and migrates outcomes cannot be piped with other actions.
     * @param currentCall Calldata of the current call to be populated
     * @param previousCall Calldata of the previous call that was executed
     * @param previousResult Result of the executed previous call
     */
    function populateWithPreviousOutput(
        bytes memory currentCall,
        bytes memory previousCall,
        bytes memory previousResult
    ) internal pure {
        if (isDeposit(previousCall) || isSwap(previousCall) || isExit(previousCall)) {
            uint256 previousOutput = abi.decode(previousResult, (uint256));
            if (isSwap(currentCall)) {
                populateSwapAmount(currentCall, previousOutput);
            } else if (isJoin(currentCall) || isWithdraw(currentCall)) {
                populateJoinOrWithdrawAmount(currentCall, previousOutput);
            }
        }
    }

    /**
     * @dev `swap` has its `amountIn` argument in the fourth place, which means
     * it will be positioned at the 132nd place of the calldata using 32 bytes.
     */
    function populateSwapAmount(bytes memory data, uint256 value) internal pure {
        assembly {
            mstore(add(data, 132), value)
        }
    }

    /**
     * @dev Both `join` and `withdraw` methods have their `amount` argument in the third place,
     * which means it will be positioned at the 100th place of the calldata using 32 bytes.
     */
    function populateJoinOrWithdrawAmount(bytes memory data, uint256 value) internal pure {
        assembly {
            mstore(add(data, 100), value)
        }
    }
}
