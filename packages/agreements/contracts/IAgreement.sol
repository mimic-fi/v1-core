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

import "@mimic-fi/v1-vault/contracts/interfaces/IPortfolio.sol";

interface IAgreement is IPortfolio {
    event ManagersSet(address[] managers);
    event WithdrawersSet(address[] withdrawers);
    event AllowedTokensSet(uint256 allowedTokens, address[] customTokens);
    event AllowedStrategiesSet(uint256 allowedStrategies, address[] customStrategies);
    event ParamsSet(address feeCollector, uint256 depositFee, uint256 withdrawFee, uint256 performanceFee, uint256 maxSwapSlippage);

    function vault() external view returns (address);

    function feeCollector() external view returns (address);

    function depositFee() external view returns (uint256);

    function withdrawFee() external view returns (uint256);

    function performanceFee() external view returns (uint256);

    function maxSwapSlippage() external view returns (uint256);

    function isManager(address account) external view returns (bool);

    function isWithdrawer(address account) external view returns (bool);

    function isStrategyAllowed(address strategy) external view returns (bool);

    function isTokenAllowed(address token) external view returns (bool);
}
