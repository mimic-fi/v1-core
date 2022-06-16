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

pragma solidity >=0.8.0;

/**
 * @title IStrategy
 * @dev Strategy interface required by Mimic's Vault
 */
interface IStrategy {
    /**
     * @dev Emitted every time a new metadata URI is set
     */
    event SetMetadataURI(string metadataURI);

    /**
     * @dev Tells the token that will be used as the strategy entry point
     */
    function getToken() external view returns (address);

    /**
     * @dev Tells how much value the strategy has over time.
     * For example, if a strategy has a value of 100 in T0, and then it has a value of 120 in T1,
     * It means it gained a 20% between T0 and T1.
     */
    function getTotalValue() external view returns (uint256);

    /**
     * @dev Tells how much a value unit means expressed in the strategy token.
     * For example, if a strategy has a value of 100 in T0, and then it has a value of 120 in T1,
     * and the value rate is 1.5, it means the strategy has earned 30 strategy tokens between T0 and T1.
     */
    function getValueRate() external view returns (uint256);

    /**
     * @dev Tell the metadata URI associated to the strategy
     */
    function getMetadataURI() external view returns (string memory);

    /**
     * @dev Join hook
     * @param amount Amount of strategy tokens to join with
     * @param data Arbitrary extra data
     * @return value Value represented by the joined amount
     * @return totalValue Final value after join
     */
    function onJoin(uint256 amount, bytes memory data) external returns (uint256 value, uint256 totalValue);

    /**
     * @dev Exit hook
     * @param ratio Ratio of shares to exit with. Note that this value is upscaled using 18 extra decimals.
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     * @return token Address of the strategy token exited with
     * @return amount Amount of strategy tokens exited with
     * @return value Value represented by the exited amount
     * @return totalValue Final value after exit
     */
    function onExit(uint256 ratio, bool emergency, bytes memory data)
        external
        returns (address token, uint256 amount, uint256 value, uint256 totalValue);
}
