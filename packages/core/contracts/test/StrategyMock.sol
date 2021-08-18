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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IStrategy.sol";

import "../libraries/FixedPoint.sol";

contract StrategyMock is IStrategy {
    using FixedPoint for uint256;

    uint256 public mockedRate;

    address public override getToken;
    uint256 public override getTotalShares;

    constructor(address _token) {
        getToken = _token;
        mockedRate = FixedPoint.ONE;
    }

    function getTokenBalance() external override view returns (uint256) {
        return mockedRate.mul(getTotalShares);
    }

    function getMetadataURI() external override pure returns (string memory) {
        return "./strategies/metadata.json";
    }

    function onJoin(uint256 amount, bytes memory) external override returns (uint256 shares) {
        shares = amount.mul(mockedRate);
        getTotalShares += shares;
    }

    function onExit(uint256 shares, bytes memory) external override returns (address, uint256) {
        getTotalShares -= shares;
        uint256 amount = shares.div(mockedRate);
        IERC20(getToken).approve(msg.sender, amount);
        return (getToken, amount);
    }

    function mockRate(uint256 newMockedRate) external {
        mockedRate = newMockedRate;
    }
}
