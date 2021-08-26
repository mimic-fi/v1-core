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

import "../libraries/Proxy.sol";

import "./Agreement.sol";

contract AgreementFactory  {
    address public immutable vault;
    address public immutable implementation;
    mapping (address => bool) public isAgreement;

    event AgreementCreated(address indexed agreement, string name);

    constructor(address _vault) {
        vault = _vault;
        implementation = address(new Agreement());
    }

    function create(
        string memory _name,
        address _feeCollector,
        uint256 _depositFee,
        uint256 _performanceFee,
        uint256 _maxSwapSlippage,
        address[] memory _managers,
        address[] memory _withdrawers,
        address[] memory _customStrategies,
        Agreement.AllowedStrategies _allowedStrategies
    ) external {
        address agreement = address(new Proxy(implementation));
        Agreement(agreement).init(vault, _feeCollector, _depositFee, _performanceFee, _maxSwapSlippage, _managers, _withdrawers, _customStrategies, _allowedStrategies);
        isAgreement[agreement] = true;
        emit AgreementCreated(agreement, _name);
    }
}
