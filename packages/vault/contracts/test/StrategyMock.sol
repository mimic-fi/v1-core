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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/IStrategy.sol';

import '../libraries/FixedPoint.sol';

contract StrategyMock is IStrategy {
    using FixedPoint for uint256;

    address public token;

    constructor(address _token) {
        token = _token;
    }

    function getMetadataURI() external pure override returns (string memory) {
        return './strategies/metadata.json';
    }

    function getToken() external view override returns (address) {
        return token;
    }

    function getTotalValue() public view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function onJoin(uint256 amount, bytes memory) external view override returns (uint256, uint256) {
        return (amount, getTotalValue());
    }

    function onExit(uint256 ratio, bool, bytes memory) external override returns (address, uint256, uint256, uint256) {
        uint256 totalValue = getTotalValue();
        uint256 value = totalValue.mul(ratio);
        IERC20(token).approve(msg.sender, value);
        return (token, value, value, totalValue - value);
    }
}
