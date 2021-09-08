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

import "./BytesHelpers.sol";

import "../interfaces/IVault.sol";

library VaultHelpers {
    using BytesHelpers for bytes;
    using BytesHelpers for bytes32;

    struct DepositParams {
        address token;
        uint256 amount;
    }

    struct WithdrawParams {
        address token;
        uint256 amount;
        address recipient;
    }

    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 slippage;
        bytes data;
    }

    struct JoinParams {
        address strategy;
        uint256 amount;
        bytes data;
    }

    struct ExitParams {
        address strategy;
        uint256 ratio;
        bool emergency;
        bytes data;
    }

    function encodeDeposit(address token, uint256 amount) internal pure returns (bytes memory) {
        return abi.encode(token, amount);
    }

    function encodeWithdraw(address token, uint256 amount, address recipient) internal pure returns (bytes memory) {
        return abi.encode(token, amount, recipient);
    }

    function encodeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) internal pure returns (bytes memory) {
        return abi.encode(tokenIn, tokenOut, amountIn, slippage, data);
    }

    function encodeJoin(address strategy, uint256 amount, bytes memory data) internal pure returns (bytes memory) {
        return abi.encode(strategy, amount, data);
    }

    function encodeExit(address strategy, uint256 ratio, bool emergency, bytes memory data) internal pure returns (bytes memory) {
        return abi.encode(strategy, ratio, emergency, data);
    }

    function decodeDeposit(bytes memory self) internal pure returns (DepositParams memory) {
        (address token, uint256 amount) = abi.decode(self, (address, uint256));
        return DepositParams({ token: token, amount: amount });
    }

    function decodeWithdraw(bytes memory self) internal pure returns (WithdrawParams memory) {
        (address token, uint256 amount, address recipient) = abi.decode(self, (address, uint256, address));
        return WithdrawParams({ token: token, amount: amount, recipient: recipient });
    }

    function decodeSwap(bytes memory self) internal pure returns (SwapParams memory) {
        (address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) = abi.decode(self, (address, address, uint256, uint256, bytes));
        return SwapParams({ tokenIn: tokenIn, tokenOut: tokenOut, amountIn: amountIn, slippage: slippage, data: data });
    }

    function decodeJoin(bytes memory self) internal pure returns (JoinParams memory) {
        (address strategy, uint256 amount, bytes memory data) = abi.decode(self, (address, uint256, bytes));
        return JoinParams({ strategy: strategy, amount: amount, data: data });
    }

    function decodeExit(bytes memory self) internal pure returns (ExitParams memory) {
        (address strategy, uint256 ratio, bool emergency, bytes memory data) = abi.decode(self, (address, uint256, bool, bytes));
        return ExitParams({ strategy: strategy, ratio: ratio, emergency: emergency, data: data });
    }

    function isDeposit(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.deposit.selector;
    }

    function isDeposit(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.deposit.selector;
    }

    function isWithdraw(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.withdraw.selector;
    }

    function isWithdraw(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.withdraw.selector;
    }

    function isSwap(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.swap.selector;
    }

    function isSwap(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.swap.selector;
    }

    function isJoin(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.join.selector;
    }

    function isJoin(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.join.selector;
    }

    function isExit(bytes32 self) internal pure returns (bool) {
        return self.toBytes4() == IVault.exit.selector;
    }

    function isExit(bytes memory self) internal pure returns (bool) {
        return self.toBytes4() == IVault.exit.selector;
    }

    function trues(uint256 size) internal pure returns (bool[] memory array) {
        array = new bool[](size);
        for (uint256 i = 0; i < size; i++) {
            array[i] = true;
        }
    }

    function populateWithPreviousOutput(bytes memory currentCall, bytes memory previousCall, bytes memory previousResult) internal pure {
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
