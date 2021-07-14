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

import "./Agreement.sol";

contract AgreementFactory  {
    address public immutable vault;
    mapping (address => bytes32) public agreementsByAddress;
    mapping (bytes32 => address) public agreementsByNameHash;

    event AgreementCreated(address indexed agreement);

    constructor(address _vault) {
        vault = _vault;
    }

    function isAgreement(address agreement) external view returns (bool) {
        return agreementsByAddress[agreement] != bytes32(0);
    }

    function isAgreement(string memory name) external view returns (bool) {
        bytes32 nameHash = keccak256(bytes(name));
        return agreementsByNameHash[nameHash] == address(0);
    }

    function create(
        string memory _name,
        uint256 _depositFee,
        uint256 _performanceFee,
        address _feeCollector,
        address[] memory _managers,
        address[] memory _withdrawers,
        Agreement.AllowedStrategies _allowedStrategies,
        address[] memory _customStrategies
    ) external {
        bytes32 nameHash = keccak256(bytes(_name));
        require(agreementsByNameHash[nameHash] == address(0), "AGREEMENT_ALREADY_REGISTERED");

        Agreement agreement = new Agreement(_name, vault, _depositFee, _performanceFee, _feeCollector, _managers, _withdrawers, _allowedStrategies, _customStrategies);
        agreementsByAddress[address(agreement)] = nameHash;
        agreementsByNameHash[nameHash] = address(agreement);
        emit AgreementCreated(address(agreement));
    }
}
