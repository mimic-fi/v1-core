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

    address public override getToken;

    constructor(address _token) {
        getToken = _token;
    }

    function getMetadataURI() external pure override returns (string memory) {
        return './strategies/metadata.json';
    }

    function onJoin(uint256 amount, bytes memory) external view override returns (uint256, uint256) {
        uint256 totalAmount = IERC20(getToken).balanceOf(address(this));
        return (amount, totalAmount);
    }

    function onExit(uint256 ratio, bool, bytes memory) external override returns (address, uint256, uint256, uint256) {
        uint256 totalAmount = IERC20(getToken).balanceOf(address(this));
        uint256 amount = totalAmount.mul(ratio);
        IERC20(getToken).approve(msg.sender, amount);
        return (getToken, amount, amount, totalAmount - amount);
    }

    function burn(uint256 ratio) external {
        uint256 totalAmount = IERC20(getToken).balanceOf(address(this));
        uint256 amountToBurn = totalAmount.mul(ratio);
        IERC20(getToken).transfer(address(1), amountToBurn);
    }
}
