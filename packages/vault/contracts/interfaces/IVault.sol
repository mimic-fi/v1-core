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

/**
 * @title IVault
 * @dev Mimic's Vault interface
 */
interface IVault {
    /**
     * @dev Emitted every time the protocol fee is changed
     */
    event ProtocolFeeSet(uint256 protocolFee);

    /**
     * @dev Emitted every time a new price oracle is set
     */
    event PriceOracleSet(address indexed priceOracle);

    /**
     * @dev Emitted every time a new swap connector is set
     */
    event SwapConnectorSet(address indexed swapConnector);

    /**
     * @dev Emitted every time the whitelisted condition for a token is changed
     */
    event WhitelistedTokenSet(address indexed token, bool whitelisted);

    /**
     * @dev Emitted every time the whitelisted condition for a strategy is changed
     */
    event WhitelistedStrategySet(address indexed strategy, bool whitelisted);

    /**
     * @dev Emitted every time an account is migrated to another one
     */
    event Migrate(address indexed account, address indexed to, bytes data);

    /**
     * @dev Emitted every time an account deposits a token
     */
    event Deposit(address indexed account, address indexed token, uint256 amount, uint256 depositFee, bytes data);

    /**
     * @dev Emitted every time an account withdraws a token
     */
    event Withdraw(
        address indexed account,
        address indexed token,
        uint256 amount,
        uint256 fromVault,
        uint256 withdrawFee,
        address recipient,
        bytes data
    );

    /**
     * @dev Emitted every time an account swaps tokens
     */
    event Swap(
        address indexed account,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 remainingIn,
        uint256 amountOut,
        bytes data
    );

    /**
     * @dev Emitted every time an account joins a strategy
     */
    event Join(address indexed account, address indexed strategy, uint256 amount, bytes data);

    /**
     * @dev Emitted every time an account exits a strategy
     */
    event Exit(
        address indexed account,
        address indexed strategy,
        uint256 amount,
        uint256 protocolFee,
        uint256 performanceFee,
        bytes data
    );

    // solhint-disable-next-line func-name-mixedcase
    function EXIT_RATIO_PRECISION() external view returns (uint256);

    /**
     * @dev Tells the max slippage value allowed by the Vault. Even though accounts can specify a custom slippage
     *      value when swapping tokens, this is capped by the Vault to avoid huge mistakes.
     */
    function maxSlippage() external view returns (uint256);

    /**
     * @dev Tells the fee charged by the protocol
     */
    function protocolFee() external view returns (uint256);

    /**
     * @dev Tells the price oracle set in the vault
     */
    function priceOracle() external view returns (address);

    /**
     * @dev Tells the swap connector set in the vault
     */
    function swapConnector() external view returns (address);

    /**
     * @dev Tells if a token is whitelisted by Mimic's Vault
     * @param token Address of the token being queried
     */
    function isTokenWhitelisted(address token) external view returns (bool);

    /**
     * @dev Tells if a strategy is whitelisted by Mimic's Vault
     * @param strategy Address of the strategy being queried
     */
    function isStrategyWhitelisted(address strategy) external view returns (bool);

    /**
     * @dev Tells the total amount of shares of a strategy
     * @param strategy Address of the strategy being queried
     */
    function getStrategyShares(address strategy) external view returns (uint256);

    /**
     * @dev Tells the current value corresponding to each share of a strategy
     * @param strategy Address of the strategy being queried
     * @custom:deprecated This method will be deprecated
     */
    function getStrategyShareValue(address strategy) external view returns (uint256);

    /**
     * @dev Tells the token balance of an account
     * @param account Address of the account being queried
     * @param token Address of the token being queried
     */
    function getAccountBalance(address account, address token) external view returns (uint256);

    /**
     * @dev Tells the strategy investment information of an account
     * @param account Address of the account being queried
     * @param strategy Address of the strategy being queried
     * @return invested Value invested in the strategy by the requested account
     * @return shares Shares held by the requested account of the strategy
     */
    function getAccountInvestment(address account, address strategy)
        external
        view
        returns (uint256 invested, uint256 shares);

    /**
     * @dev Tells the current value invested by an account in a strategy
     * @param account Address of the account being queried
     * @param strategy Address of the strategy being queried
     * @custom:deprecated This method will be deprecated
     */
    function getAccountCurrentValue(address account, address strategy) external view returns (uint256);

    /**
     * @dev Query the outcome of a set of actions. This call reverts to make sure the actions are not committed.
     *      This method should not be used on-chain, only to simulate a set of actions and read their results.
     * @param data List of encoded calls to execute in the Vault
     * @param readsOutput List of conditions to tell whether each call in the list should read the output produced
     *        by its previous call
     */
    function query(bytes[] memory data, bool[] memory readsOutput) external returns (bytes[] memory results);

    /**
     * @dev Execute a set of actions
     * @param data List of encoded calls to execute in the Vault
     * @param readsOutput List of conditions to tell whether each call in the list should read the output produced
     *        by its previous call
     */
    function batch(bytes[] memory data, bool[] memory readsOutput) external returns (bytes[] memory results);

    /**
     * @dev Migrates an account's positions to another one
     * @param account Address of the account migrating positions from
     * @param to Address of the account migrating positions to
     * @param data Arbitrary data
     */
    function migrate(address account, address to, bytes memory data) external;

    /**
     * @dev Deposits tokens for an account
     * @param account Address of the account depositing tokens to
     * @param token Address of the token being deposited
     * @param amount Amount of tokens being deposited
     * @param data Arbitrary data
     */
    function deposit(address account, address token, uint256 amount, bytes memory data)
        external
        returns (uint256 deposited);

    /**
     * @dev Withdraws tokens from an account
     * @param account Address of the account withdrawing tokens from
     * @param token Address of the token being withdrawn
     * @param amount Amount of tokens being withdrawn
     * @param recipient Address of the account withdrawing tokens to
     * @param data Arbitrary data
     */
    function withdraw(address account, address token, uint256 amount, address recipient, bytes memory data)
        external
        returns (uint256 withdrawn);

    /**
     * @dev Swaps two tokens
     * @param account Address of the account swapping tokens
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of tokenIn being swapped
     * @param slippage Accepted slippage compared to the price queried externally
     * @param data Arbitrary extra data
     */
    function swap(
        address account,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) external returns (uint256 amountOut);

    /**
     * @dev Joins a strategy
     * @param account Address of the account joining the strategy
     * @param strategy Address of the strategy to join
     * @param amount Amount of strategy tokens joining with
     * @param data Arbitrary extra data
     */
    function join(address account, address strategy, uint256 amount, bytes memory data)
        external
        returns (uint256 shares);

    /**
     * @dev Exits a strategy
     * @param account Address of the account exiting the strategy
     * @param strategy Address of the strategy to exit
     * @param ratio Ratio of strategy shares to exit with
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     */
    function exit(address account, address strategy, uint256 ratio, bool emergency, bytes memory data)
        external
        returns (uint256 received);

    /**
     * @dev Sets a new protocol fee
     * @param newProtocolFee New protocol fee to be set
     */
    function setProtocolFee(uint256 newProtocolFee) external;

    /**
     * @dev Sets a new price oracle
     * @param newPriceOracle New price oracle to be set
     */
    function setPriceOracle(address newPriceOracle) external;

    /**
     * @dev Sets a new swap connector
     * @param newSwapConnector New swap connector to be set
     */
    function setSwapConnector(address newSwapConnector) external;

    /**
     * @dev Updates the whitelisted condition for a set of tokens
     * @param tokens List of tokens to update their whitelisted condition
     * @param whitelisted List of whitelisted conditions to be set for each token in the list
     */
    function setWhitelistedTokens(address[] memory tokens, bool[] memory whitelisted) external;

    /**
     * @dev Updates the whitelisted condition for a set of strategies
     * @param strategies List of strategies to update their whitelisted condition
     * @param whitelisted List of whitelisted conditions to be set for each strategy in the list
     */
    function setWhitelistedStrategies(address[] memory strategies, bool[] memory whitelisted) external;
}
