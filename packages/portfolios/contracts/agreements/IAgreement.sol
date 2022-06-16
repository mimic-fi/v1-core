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

import '@mimic-fi/v1-vault/contracts/interfaces/IPortfolio.sol';

/**
 * @title IAgreement
 * @dev Specialization of a wallet that can be managed by a third party
 */
interface IAgreement is IPortfolio {
    /**
     * @dev Emitted every time the set of allowed managers is changed
     */
    event ManagersSet(address[] managers);

    /**
     * @dev Emitted every time the set of allowed withdrawers is changed
     */
    event WithdrawersSet(address[] withdrawers);

    /**
     * @dev Emitted every time the allowed tokens configuration is changed
     */
    event AllowedTokensSet(uint256 allowedTokens, address[] customTokens);

    /**
     * @dev Emitted every time the allowed strategies configuration is changed
     */
    event AllowedStrategiesSet(uint256 allowedStrategies, address[] customStrategies);

    /**
     * @dev Emitted every time the fee-related configuration is changed
     */
    event ParamsSet(
        address feeCollector,
        uint256 depositFee,
        uint256 withdrawFee,
        uint256 performanceFee,
        uint256 maxSwapSlippage
    );

    /**
     * @dev Tells the Mimic's Vault reference
     */
    function vault() external view returns (address);

    /**
     * @dev Tells the address that will receive the manager collected fees
     */
    function feeCollector() external view returns (address);

    /**
     * @dev Tells the deposit fee amount: 1e18 = 100%
     */
    function depositFee() external view returns (uint256);

    /**
     * @dev Tells the withdraw fee amount: 1e18 = 100%
     */
    function withdrawFee() external view returns (uint256);

    /**
     * @dev Tells the performance fee amount: 1e18 = 100%
     */
    function performanceFee() external view returns (uint256);

    /**
     * @dev Tells the maximum slippage allowed by the wallet owner
     */
    function maxSwapSlippage() external view returns (uint256);

    /**
     * @dev Tells if an account is an allowed manager or not
     * @param account Address of the account being queried
     */
    function isManager(address account) external view returns (bool);

    /**
     * @dev Tells if an account is an allowed withdrawer or not
     * @param account Address of the account being queried
     */
    function isWithdrawer(address account) external view returns (bool);

    /**
     * @dev Tells if a given strategy is allowed or not based on the allowed strategies configuration
     * @param strategy Address of the strategy being queried
     */
    function isStrategyAllowed(address strategy) external view returns (bool);

    /**
     * @dev Tells if a given token is allowed or not based on the allowed tokens configuration
     * @param token Address of the token being queried
     */
    function isTokenAllowed(address token) external view returns (bool);
}
