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

import "@openzeppelin/contracts/utils/Address.sol";

import "./VaultHelpers.sol";
import "../interfaces/IVault.sol";

/**
 * @dev Answering specific queries to the like the result of a join or an exit may be too difficult.
 * Then, a very simple way to do that is to 'simulate' the action being queried.
 * To guarantee the simulation won't perform any changes, it forces a revert at the end of the call.
 * The trick is to include the result as part of the revert reason, so it can be decoded by the caller.
 *
 * This contract provides a main query function that allows concatenating different queries.
 * It is not expected to be used from third-party contracts, but from any off-chain consumer through static calls.
 */
contract VaultQuery {
    using VaultHelpers for bytes;

    /**
     * @dev Calls `batchRevert` and decodes the result
     */
    function query(bytes[] memory data, bool[] memory readsOutput) public virtual returns (bytes[] memory) {
        // solhint-disable avoid-low-level-calls
        bytes memory queryData = abi.encodeWithSelector(VaultQuery.batchRevert.selector, data, readsOutput);
        (bool success, ) = address(this).delegatecall(queryData);

        assembly {
            switch success
            case 0 {
                // Copy the first 4 bytes to check if it matches with the expected signature
                returndatacopy(0, 0, 4)
                let error := and(mload(0), 0xffffffff00000000000000000000000000000000000000000000000000000000)

                // If the first 4 bytes don't match with the expected signature, forward the revert reason
                if eq(eq(error, 0x492e5b2c00000000000000000000000000000000000000000000000000000000), 0) {
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }

                // Get rid of the error signature and the return data length
                let size := sub(returndatasize(), 36)
                returndatacopy(0, 36, size)
                return(0, size)
            }
            default {
                // This call should always revert, fail if that was not the case
                invalid()
            }
        }
    }

    /**
     * @dev Calls `batch` function and reverts immediately after
     */
    function batchRevert(bytes[] memory data, bool[] memory readsOutput) external returns (bytes[] memory) {
        bytes memory batchData = abi.encodeWithSelector(IVault.batch.selector, data, readsOutput);
        bytes memory result = Address.functionDelegateCall(address(this), batchData);

        assembly {
            // Send a custom error signature "QueryError(bytes[])" which is 0x492e5b2c
            mstore(sub(result, 32), 0x00000000000000000000000000000000000000000000000000000000492e5b2c)
            let start := sub(result, 4)
            let size := add(returndatasize(), 36) // sig + length + data
            revert(start, size)
        }
    }
}
