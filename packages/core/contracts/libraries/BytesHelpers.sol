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

library BytesHelpers {
    function toBytes32(bytes4 self) internal pure returns (bytes32 result) {
        assembly { result := self }
    }

    function decodeAddress(bytes32[] memory self, uint256 index) internal pure returns (address) {
        require(self.length > index, "INVALID_BYTES_ARRAY_INDEX");
        return address(bytes20(self[index]));
    }

    function isJoinOrExit(bytes32 self) internal pure returns (bool) {
        return isJoin(self) || isJoinSwap(self) || isExit(self);
    }

    function isJoin(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.join.selector);
    }

    function isJoinSwap(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.joinSwap.selector);
    }

    function isExit(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.exit.selector);
    }

    function isWithdraw(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.withdraw.selector);
    }

    function isDeposit(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.deposit.selector);
    }

    function supportsBeforeDeposit(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 0);
    }

    function supportsAfterDeposit(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 1);
    }

    function supportsBeforeWithdraw(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 2);
    }

    function supportsAfterWithdraw(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 3);
    }

    function supportsBeforeJoin(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 4);
    }

    function supportsAfterJoin(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 5);
    }

    function supportsBeforeExit(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 6);
    }

    function supportsAfterExit(bytes1 self) internal pure returns (bool) {
        return isBitSet(self, 7);
    }

    function isBitSet(bytes1 self, uint256 pos) internal pure returns (bool) {
        return (uint8(self) & (1 << pos)) != 0;
    }
}
