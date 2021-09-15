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

library FixedPoint {
    uint256 internal constant ONE = 1e18; // 18 decimal places

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, 'ADD_OVERFLOW');
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, 'SUB_OVERFLOW');
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c0 = a * b;
        require(a == 0 || c0 / a == b, 'MUL_OVERFLOW');
        uint256 c1 = c0 + (ONE / 2);
        require(c1 >= c0, 'MUL_OVERFLOW');
        return c1 / ONE;
    }

    function mulDown(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 product = a * b;
        require(a == 0 || product / a == b, 'MUL_OVERFLOW');
        return product / ONE;
    }

    function mulUp(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 product = a * b;
        require(a == 0 || product / a == b, 'MUL_OVERFLOW');
        return product == 0 ? 0 : (((product - 1) / ONE) + 1);
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, 'ZERO_DIVISION');
        uint256 c0 = a * ONE;
        require(a == 0 || c0 / a == ONE, 'DIV_INTERNAL');
        uint256 c1 = c0 + (b / 2);
        require(c1 >= c0, 'DIV_INTERNAL');
        return c1 / b;
    }

    function divDown(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, 'ZERO_DIVISION');
        uint256 aInflated = a * ONE;
        require(aInflated / a == ONE, 'DIV_INTERNAL');
        return aInflated / b;
    }

    function divUp(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, 'ZERO_DIVISION');
        if (a == 0) return 0;
        uint256 aInflated = a * ONE;
        require(aInflated / a == ONE, 'DIV_INTERNAL');
        return ((aInflated - 1) / b) + 1;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
