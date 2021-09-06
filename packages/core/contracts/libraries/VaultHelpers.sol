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

import "../interfaces/IVault.sol";
import "./BytesHelpers.sol";

library VaultHelpers {
    using BytesHelpers for bytes;
    using BytesHelpers for bytes32;

    function isDeposit(bytes memory self) internal pure returns (bool) {
        return isDeposit(self.toBytes4());
    }

    function isDeposit(bytes4 self) internal pure returns (bool) {
        return self == IVault.deposit.selector;
    }

    function isWithdraw(bytes memory self) internal pure returns (bool) {
        return isWithdraw(self.toBytes4());
    }

    function isWithdraw(bytes4 self) internal pure returns (bool) {
        return self == IVault.withdraw.selector;
    }

    function isSwap(bytes memory self) internal pure returns (bool) {
        return isSwap(self.toBytes4());
    }

    function isSwap(bytes4 self) internal pure returns (bool) {
        return self == IVault.swap.selector;
    }

    function isJoin(bytes memory self) internal pure returns (bool) {
        return isJoin(self.toBytes4());
    }

    function isJoin(bytes4 self) internal pure returns (bool) {
        return self == IVault.join.selector;
    }

    function isExit(bytes memory self) internal pure returns (bool) {
        return isExit(self.toBytes4());
    }

    function isExit(bytes4 self) internal pure returns (bool) {
        return self == IVault.exit.selector;
    }

    function isJoinOrExit(bytes4 self) internal pure returns (bool) {
        return isJoin(self) || isExit(self);
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
