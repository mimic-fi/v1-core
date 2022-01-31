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

pragma solidity >=0.5.0 <0.9.0;

interface IVault {
    event MaxSlippageSet(uint256 maxSlippage);
    event ProtocolFeeSet(uint256 protocolFee);
    event PriceOracleSet(address indexed priceOracle);
    event SwapConnectorSet(address indexed swapConnector);
    event WhitelistedTokenSet(address indexed token, bool whitelisted);
    event WhitelistedStrategySet(address indexed strategy, bool whitelisted);
    event Deposit(address indexed account, address indexed token, uint256 amount, uint256 depositFee);
    event Withdraw(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 fromVault,
        uint256 withdrawFee,
        address recipient
    );
    event Swap(
        address indexed account,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 remainingIn,
        uint256 amountOut
    );
    event Join(address indexed account, address indexed strategy, uint256 amount);
    event Exit(
        address indexed account,
        address indexed strategy,
        uint256 amount,
        uint256 protocolFee,
        uint256 performanceFee
    );

    // solhint-disable-next-line func-name-mixedcase
    function EXIT_RATIO_PRECISION() external view returns (uint256);

    function maxSlippage() external view returns (uint256);

    function protocolFee() external view returns (uint256);

    function priceOracle() external view returns (address);

    function swapConnector() external view returns (address);

    function isTokenWhitelisted(address token) external view returns (bool);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function getStrategyShares(address strategy) external view returns (uint256);

    function getStrategyShareValue(address strategy) external view returns (uint256);

    function getAccountBalance(address account, address token) external view returns (uint256);

    function getAccountInvestment(address account, address strategy)
        external
        view
        returns (uint256 invested, uint256 shares);

    function getAccountCurrentValue(address account, address strategy) external view returns (uint256);

    function query(bytes[] memory data, bool[] memory readsOutput) external returns (bytes[] memory results);

    function batch(bytes[] memory data, bool[] memory readsOutput) external returns (bytes[] memory results);

    function deposit(address account, address token, uint256 amount) external returns (uint256 deposited);

    function withdraw(address account, address token, uint256 amount, address recipient)
        external
        returns (uint256 withdrawn);

    function swap(
        address account,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external returns (uint256 amountOut);

    function join(address account, address strategy, uint256 amount, bytes memory data)
        external
        returns (uint256 shares);

    function exit(address account, address strategy, uint256 ratio, bool emergency, bytes memory data)
        external
        returns (uint256 received);

    function setProtocolFee(uint256 newProtocolFee) external;

    function setPriceOracle(address newPriceOracle) external;

    function setSwapConnector(address newSwapConnector) external;

    function setWhitelistedTokens(address[] memory tokens, bool[] memory whitelisted) external;

    function setWhitelistedStrategies(address[] memory strategies, bool[] memory whitelisted) external;
}
