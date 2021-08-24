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

// solhint-disable func-visibility

function trues(uint256 size) pure returns (bool[] memory array) {
    array = new bool[](size);
    for (uint256 i = 0; i < size; i++) {
        array[i] = true;
    }
}

function arr() pure returns (bytes32[] memory result) {
    result = new bytes32[](0);
}

function arr(address p1) pure returns (bytes32[] memory result) {
    result = new bytes32[](1);
    result[0] = bytes32(bytes20(p1));
}

function arr(address p1, uint256 p2) pure returns (bytes32[] memory result) {
    result = new bytes32[](2);
    result[0] = bytes32(bytes20(p1));
    result[1] = bytes32(p2);
}

function arr(address p1, address p2, uint256 p3) pure returns (bytes32[] memory result) {
    result = new bytes32[](3);
    result[0] = bytes32(bytes20(p1));
    result[1] = bytes32(bytes20(p2));
    result[2] = bytes32(p3);
}

function arr(address p1, address p2, uint256 p3, uint256 p4) pure returns (bytes32[] memory result) {
    result = new bytes32[](4);
    result[0] = bytes32(bytes20(p1));
    result[1] = bytes32(bytes20(p2));
    result[2] = bytes32(p3);
    result[3] = bytes32(p4);
}
