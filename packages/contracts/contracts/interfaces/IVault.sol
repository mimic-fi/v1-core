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

interface IVault {
    event Deposited(address indexed account, address[] tokens, uint256[] amounts, address caller);
    event Withdrawn(address indexed account, address[] tokens, uint256[] amounts, address recipient, address caller);
    event Joined(address indexed account, address indexed strategy, uint256 amount, uint256 shares, address caller);
    event Exited(address indexed account, address indexed strategy, uint256 amount, uint256 shares, uint256 protocolFee, uint256 performanceFee, address caller);
    event ProtocolFeeChanged(uint256 protocolFee);
    event SwapConnectorChanged(address swapConnector);
    event WhitelistedStrategyChanged(address indexed strategy, bool whitelisted);

    function protocolFee() external view returns (uint256);

    function swapConnector() external view returns (address);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function getAccountBalance(address account, address token) external view returns (uint256);

    function getAccountInvestment(address account, address strategy) external view returns (uint256 invested, uint256 shares);

    function batch(bytes[] memory data) external returns (bytes[] memory results);

    function deposit(address account, address[] memory tokens, uint256[] memory amounts) external;

    function withdraw(address account, address[] memory tokens, uint256[] memory amounts, address recipient) external;

    function joinSwap(address account, address strategy, address token, uint256 amountIn, uint256 minAmountOut, bytes memory data) external;

    function join(address account, address strategy, uint256 amount, bytes memory data) external;

    function exit(address account, address strategy, uint256 ratio, bytes memory data) external;

    function setProtocolFee(uint256 newProtocolFee) external;

    function setSwapConnector(address newSwapConnector) external;

    function setWhitelistedStrategies(address[] memory strategies, bool[] memory whitelisted) external;
}
