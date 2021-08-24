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

    function decodeUint256(bytes32[] memory self, uint256 index) internal pure returns (uint256) {
        require(self.length > index, "INVALID_BYTES_ARRAY_INDEX");
        return uint256(self[index]);
    }

    function isDeposit(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.deposit.selector);
    }

    function isWithdraw(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.withdraw.selector);
    }

    function isSwap(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.swap.selector);
    }

    function isJoin(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.join.selector);
    }

    function isExit(bytes32 self) internal pure returns (bool) {
        return self == toBytes32(IVault.exit.selector);
    }

    function isJoinOrExit(bytes32 self) internal pure returns (bool) {
        return isJoin(self) || isExit(self);
    }

    function supportsBeforeDeposit(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 0);
    }

    function supportsAfterDeposit(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 1);
    }

    function supportsBeforeWithdraw(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 2);
    }

    function supportsAfterWithdraw(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 3);
    }

    function supportsBeforeSwap(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 4);
    }

    function supportsAfterSwap(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 5);
    }

    function supportsBeforeJoin(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 6);
    }

    function supportsAfterJoin(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 7);
    }

    function supportsBeforeExit(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 8);
    }

    function supportsAfterExit(bytes2 self) internal pure returns (bool) {
        return isBitSet(self, 9);
    }

    function isBitSet(bytes2 self, uint256 pos) internal pure returns (bool) {
        return (uint16(self) & (1 << pos)) != 0;
    }
}
