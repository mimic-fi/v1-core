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

library PortfoliosData {
    enum Type {
        None,
        Withdrawer,
        Slippage
    }

    function isEmpty(bytes memory data) internal pure returns (bool) {
        return data.length == 0;
    }

    function isWithdrawer(bytes memory data) internal pure returns (bool) {
        return !isEmpty(data) && decodeType(data) == Type.Withdrawer;
    }

    function isSlippage(bytes memory data) internal pure returns (bool) {
        return !isEmpty(data) && decodeType(data) == Type.Slippage;
    }

    function decodeType(bytes memory data) internal pure returns (Type) {
        return abi.decode(data, (Type));
    }

    function decodeWithdrawer(bytes memory data) internal pure returns (address withdrawer) {
        (, withdrawer) = abi.decode(data, (Type, address));
    }

    function decodeSlippage(bytes memory data) internal pure returns (uint256 slippage) {
        (, slippage) = abi.decode(data, (Type, uint256));
    }
}
