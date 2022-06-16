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

/**
 * @title PortfoliosData
 * @dev Helper methods used to work with data values expected by the wallets
 */
library PortfoliosData {
    /**
     * @dev Supported types of extra data encoding used for the wallets implementations
     */
    enum Type {
        None,
        Withdrawer,
        Slippage
    }

    /**
     * @dev Tells if a bytes array is empty or not
     */
    function isEmpty(bytes memory data) internal pure returns (bool) {
        return data.length == 0;
    }

    /**
     * @dev Tells if a bytes array corresponds to a withdrawer-type encoding
     */
    function isWithdrawer(bytes memory data) internal pure returns (bool) {
        return !isEmpty(data) && decodeType(data) == Type.Withdrawer;
    }

    /**
     * @dev Tells if a bytes array corresponds to a slippage-type encoding
     */
    function isSlippage(bytes memory data) internal pure returns (bool) {
        return !isEmpty(data) && decodeType(data) == Type.Slippage;
    }

    /**
     * @dev Tries decoding an enum type from a bytes array
     */
    function decodeType(bytes memory data) internal pure returns (Type) {
        return abi.decode(data, (Type));
    }

    /**
     * @dev Tries decoding a withdrawer from a withdrawer-type encoded bytes array
     */
    function decodeWithdrawer(bytes memory data) internal pure returns (address withdrawer) {
        (, withdrawer) = abi.decode(data, (Type, address));
    }

    /**
     * @dev Tries decoding a slippage from a slippage-type encoded bytes array
     */
    function decodeSlippage(bytes memory data) internal pure returns (uint256 slippage) {
        (, slippage) = abi.decode(data, (Type, uint256));
    }
}
