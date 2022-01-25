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

pragma solidity >=0.5.0 <0.9.0;

interface IStrategy {
    event SetMetadataURI(string metadataURI);

    function getToken() external view returns (address);

    function getTotalValue() external view returns (uint256);

    function getValueRate() external view returns (uint256);

    function getMetadataURI() external view returns (string memory);

    function onJoin(uint256 amount, bytes memory data) external returns (uint256 value, uint256 totalValue);

    function onExit(uint256 ratio, bool emergency, bytes memory data)
        external
        returns (address token, uint256 amount, uint256 value, uint256 totalValue);
}
