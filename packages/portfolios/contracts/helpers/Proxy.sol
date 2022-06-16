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
 * @title Proxy
 * @dev Proxy contract used to make Agreements deployments cheaper
 */
contract Proxy {
    // Address to delegates calls to
    address public immutable implementation;

    /**
     * @dev Initializes the proxy contract
     * @param _implementation Address to delegates calls to
     */
    constructor(address _implementation) {
        implementation = _implementation;
    }

    /**
     * @dev Delegates calls to the implementation address
     */
    fallback() external payable {
        _fallback();
    }

    /**
     * @dev Accepts ETH and delegates its handling to the implementation address
     */
    receive() external payable {
        _fallback();
    }

    /**
     * @dev Delegates calls to the implementation address
     */
    function _fallback() internal {
        // solhint-disable-previous-line no-complex-fallback
        // solhint-disable-next-line no-inline-assembly
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
