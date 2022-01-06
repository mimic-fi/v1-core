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

    uint256 public mockedRate;

    address public override getToken;
    uint256 public getTotalValue;

    constructor(address _token) {
        getToken = _token;
        mockedRate = FixedPoint.ONE;
    }

    function getMetadataURI() external pure override returns (string memory) {
        return './strategies/metadata.json';
    }

    function onJoin(uint256 amount, bytes memory) external override returns (uint256 value, uint256 totalValue) {
        value = amount.div(mockedRate);
        getTotalValue += amount;
        totalValue = getTotalValue.div(mockedRate);
    }

    function onExit(uint256 ratio, bool, bytes memory) external override returns (address, uint256, uint256, uint256) {
        uint256 value = getTotalValue.mul(ratio);
        getTotalValue -= value;
        uint256 amount = value.mul(mockedRate);
        IERC20(getToken).approve(msg.sender, amount);
        return (getToken, amount, value, getTotalValue);
    }

    function mockRate(uint256 newMockedRate) external {
        mockedRate = newMockedRate;
    }
}
