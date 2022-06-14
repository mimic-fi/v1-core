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

import './Agreement.sol';
import '../helpers/Proxy.sol';

/**
 * @title AgreementFactory
 * @dev Factory contract to create Agreement contracts, it uses immutable proxies to make deployments cheaper
 */
contract AgreementFactory {
    /**
     * @dev Emitted every time a new agreement instance is created
     */
    event AgreementCreated(address indexed agreement, string name);

    // Mimic Vault reference
    address public immutable vault;

    // Agreement implementation
    address public immutable implementation;

    // List of agreements created by this factory contract
    mapping (address => bool) public isAgreement;

    /**
     * @dev Initializes the agreement factory contract
     * @param _weth WETH reference to be used
     * @param _vault Mimic Vault reference
     */
    constructor(IWETH _weth, address _vault) {
        vault = _vault;
        implementation = address(new Agreement(_weth));
    }

    /**
     * @dev Creates a new agreement
     * @param _name Name to be related to the agreement
     * @param _feeCollector Address that will receive the manager collected fees
     * @param _depositFee Deposit fee amount
     * @param _withdrawFee Withdraw fee amount
     * @param _performanceFee Performance fee amount
     * @param _maxSwapSlippage Maximum slippage allowed by the wallet owner
     * @param _managers List of allowed managers
     * @param _withdrawers List of allowed withdrawers
     * @param _customTokens List of custom tokens
     * @param _allowedTokens Allowed tokens configuration: only custom, custom and whitelisted, or any
     * @param _customStrategies List of custom strategies
     * @param _allowedStrategies Allowed strategies configuration: only custom, custom and whitelisted, or any
     */
    function create(
        string memory _name,
        address _feeCollector,
        uint256 _depositFee,
        uint256 _withdrawFee,
        uint256 _performanceFee,
        uint256 _maxSwapSlippage,
        address[] memory _managers,
        address[] memory _withdrawers,
        address[] memory _customTokens,
        Agreement.Allowed _allowedTokens,
        address[] memory _customStrategies,
        Agreement.Allowed _allowedStrategies
    ) external {
        address payable agreement = payable(new Proxy(implementation));
        Agreement(agreement).initialize(
            vault,
            _feeCollector,
            _depositFee,
            _withdrawFee,
            _performanceFee,
            _maxSwapSlippage,
            _managers,
            _withdrawers,
            _customTokens,
            _allowedTokens,
            _customStrategies,
            _allowedStrategies
        );
        isAgreement[agreement] = true;
        emit AgreementCreated(agreement, _name);
    }
}
