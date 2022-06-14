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

import '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import '@mimic-fi/v1-vault/contracts/interfaces/IStrategy.sol';
import '@mimic-fi/v1-vault/contracts/interfaces/IVault.sol';
import '@mimic-fi/v1-vault/contracts/libraries/VaultHelpers.sol';

import './IAgreement.sol';
import '../helpers/IWETH.sol';
import '../helpers/PortfoliosData.sol';

/**
 * @title Agreement
 * @dev Immutable version of a Mimic wallet. It is intended when managers have to create wallets for third parties.
 */
contract Agreement is IAgreement, ReentrancyGuard, Initializable {
    using Address for address;
    using SafeERC20 for IERC20;
    using VaultHelpers for bytes;
    using VaultHelpers for bytes32;
    using PortfoliosData for bytes;

    /**
     * @dev Enum used to specify tokens and strategies configuration
     */
    enum Allowed {
        OnlyCustom,
        CustomAndWhitelisted,
        Any
    }

    // Maximum value allowed for deposit fees: 100%
    uint256 internal constant MAX_DEPOSIT_FEE = 1e18;

    // Maximum value allowed for withdraw fees: 100%
    uint256 internal constant MAX_WITHDRAW_FEE = 1e18;

    // Maximum value allowed for performance fees: 100%
    uint256 internal constant MAX_PERFORMANCE_FEE = 1e18;

    // WETH reference
    IWETH public immutable weth;

    // Mimic Vault reference
    address public override vault;

    // Address that will receive the manager collected fees
    address public override feeCollector;

    // Deposit fee amount: 1e18 = 100%
    uint256 public override depositFee;

    // Withdraw fee amount: 1e18 = 100%
    uint256 public override withdrawFee;

    // Performance fee amount: 1e18 = 100%
    uint256 public override performanceFee;

    // Maximum slippage allowed by the wallet owner
    uint256 public override maxSwapSlippage;

    // List of allowed managers indexed by address
    mapping (address => bool) public override isManager;

    // List of allowed withdrawers indexed by address
    mapping (address => bool) public override isWithdrawer;

    // Allowed tokens configuration: only custom, custom and whitelisted, or any
    Allowed public allowedTokens;

    // List of custom tokens
    mapping (address => bool) public isCustomToken;

    // Allowed strategies configuration: only custom, custom and whitelisted, or any
    Allowed public allowedStrategies;

    // List of custom strategies
    mapping (address => bool) public isCustomStrategy;

    /**
     * @dev Used to mark functions that can only be called by the protocol vault
     */
    modifier onlyVault() {
        require(msg.sender == vault, 'SENDER_NOT_VAULT');
        _;
    }

    /**
     * @dev Initializes the agreement implementation contract
     * @param _weth WETH reference to be used
     */
    constructor(IWETH _weth) initializer {
        weth = _weth;
    }

    /**
     * @dev Initializes the agreement instance contract, it can only be called once
     * @param _vault Mimic Vault reference
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
    function initialize(
        address _vault,
        address _feeCollector,
        uint256 _depositFee,
        uint256 _withdrawFee,
        uint256 _performanceFee,
        uint256 _maxSwapSlippage,
        address[] memory _managers,
        address[] memory _withdrawers,
        address[] memory _customTokens,
        Allowed _allowedTokens,
        address[] memory _customStrategies,
        Allowed _allowedStrategies
    ) external initializer {
        _setVault(_vault);
        _setParams(_feeCollector, _depositFee, _withdrawFee, _performanceFee, _maxSwapSlippage);
        _setManagers(_managers);
        _setWithdrawers(_withdrawers);
        _setAllowedTokens(_customTokens, _allowedTokens);
        _setAllowedStrategies(_customStrategies, _allowedStrategies);
    }

    /**
     * @dev Tells the token balance of the agreement
     * @param token Address of the token being queried
     */
    function getTokenBalance(address token) public view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Tells the deposit fee configured in the agreement.
     *      Note that it does not depend on the token being deposited.
     */
    function getDepositFee(address) external view override returns (uint256, address) {
        return (depositFee, feeCollector);
    }

    /**
     * @dev Tells the withdraw fee configured in the agreement.
     *      Note that it does not depend on the token being withdrawn.
     */
    function getWithdrawFee(address) external view override returns (uint256, address) {
        return (withdrawFee, feeCollector);
    }

    /**
     * @dev Tells the performance fee configured in the agreement.
     *      Note that it does not depend on the strategy interacted with.
     */
    function getPerformanceFee(address) external view override returns (uint256, address) {
        return (performanceFee, feeCollector);
    }

    /**
     * @dev Tells if a given token is allowed or not based on the allowed tokens configuration
     * @param token Address of the token being queried
     */
    function isTokenAllowed(address token) public view override returns (bool) {
        if (allowedTokens == Allowed.Any || isCustomToken[token]) {
            return true;
        }

        return allowedTokens == Allowed.CustomAndWhitelisted && IVault(vault).isTokenWhitelisted(token);
    }

    /**
     * @dev Tells if a given strategy is allowed or not based on the allowed tokens configuration
     * @param strategy Address of the strategy being queried
     */
    function isStrategyAllowed(address strategy) public view override returns (bool) {
        if (allowedStrategies == Allowed.Any || isCustomStrategy[strategy]) {
            return true;
        }

        return allowedStrategies == Allowed.CustomAndWhitelisted && IVault(vault).isStrategyWhitelisted(strategy);
    }

    /**
     * @dev Tells if a certain action is allowed by the agreement
     * @param who Who is trying to perform the action: only managers are allowed
     * @param where What's the contract being called to perform the action: only Mimic's vault is allowed
     * @param what What's the action being performed
     * @param how The details of the action being performed
     * @notice The following scenarios are allowed by this agreement, any other not mentioned here is not allowed:
     *
     * 1. Swap: Only when the token out is allowed by the allowed tokens configuration, when the requested slippage
     * is lower than or equal to the max slippage value set in the agreement, and when the extra data is empty.
     *
     * 2. Join: Only when the requested strategy is allowed by the allowed strategies configuration, when the extra
     * data has a slippage value encoded and it is lower than or equal to the max slippage value set in the agreement.
     *
     * 3. Exit: If an emergency exit is requested it only allows requests when there is a slippage value encoded in
     * the extra data field and the sender is an allowed withdrawer. Otherwise, it only allows requests when the extra
     * data has a slippage value encoded and it is lower than or equal to the max slippage value set in the agreement.
     *
     * 4. Withdraw: If there is no data encoded, it only allows withdrawing tokens when the recipient is a withdrawer.
     * If there is data encoded, it must have an encoded withdrawer, the recipient must be the agreement itself, and
     * the token must be WETH. The latter allows requesting an ETH withdraw instead, WETH will be unwrapped in the
     * `afterWithdraw` callback.
     *
     * 5. Deposit: Only when there is no data encoded.
     *
     * 6. Migrate: Only when there is no data encoded.
     */
    function canPerform(address who, address where, bytes32 what, bytes memory how)
        external
        view
        override
        returns (bool)
    {
        // If the sender is not allowed, then it cannot perform any actions
        if (!isManager[who]) {
            return false;
        }

        // This agreement only trusts the vault
        if (where != address(vault)) {
            return false;
        }

        // Eval different actions and parameters
        if (what.isSwap()) {
            VaultHelpers.SwapParams memory params = how.decodeSwap();
            return isTokenAllowed(params.tokenOut) && params.slippage <= maxSwapSlippage && params.data.isEmpty();
        } else if (what.isJoin()) {
            VaultHelpers.JoinParams memory params = how.decodeJoin();
            return
                isStrategyAllowed(params.strategy) &&
                params.data.isSlippage() &&
                params.data.decodeSlippage() <= maxSwapSlippage;
        } else if (what.isExit()) {
            VaultHelpers.ExitParams memory params = how.decodeExit();
            if (!params.data.isSlippage()) return false;
            if (params.emergency) return isWithdrawer[who];
            return params.data.decodeSlippage() <= maxSwapSlippage;
        } else if (what.isWithdraw()) {
            VaultHelpers.WithdrawParams memory params = how.decodeWithdraw();
            if (isWithdrawer[params.recipient] && params.data.isEmpty()) return true;
            return
                IWETH(params.token) == weth &&
                params.recipient == address(this) &&
                params.data.isWithdrawer() &&
                isWithdrawer[params.data.decodeWithdrawer()];
        } else if (what.isDeposit()) {
            VaultHelpers.DepositParams memory params = how.decodeDeposit();
            return params.data.isEmpty();
        } else {
            // Migrations are not supported
            return false;
        }
    }

    /**
     * @dev Tells the supported callbacks by the wallet.
     * This wallet version only supports 'before deposit', 'before withdraw', and 'after withdraw': 0000001101 (0x000D).
     */
    function getSupportedCallbacks() external pure override returns (bytes2) {
        return bytes2(0x000D);
    }

    /**
     * @dev It allows receiving ETH
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Before deposit callback. It allows the user working with ETH, this will be wrapped to WETH.
     */
    function beforeDeposit(address, address token, uint256 amount, bytes memory) external override onlyVault {
        if (token == address(weth) && address(this).balance > 0) {
            weth.deposit{ value: address(this).balance }();
        }
        _safeApprove(token, amount);
    }

    /**
     * @dev After deposit callback, not supported
     */
    function afterDeposit(address, address, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Before withdraw callback, not supported
     */
    function beforeWithdraw(address, address token, uint256 amount, address, bytes memory) external override onlyVault {
        _safeApprove(token, Math.min(amount, getTokenBalance(token)));
    }

    /**
     * @dev After withdraw callback. It allows the user withdrawing ETH directly unwrapping any requested WETH amound.
     */
    function afterWithdraw(address, address token, uint256 amount, address recipient, bytes memory data)
        external
        override
        onlyVault
    {
        if (token == address(weth) && amount > 0 && recipient == address(this)) {
            weth.withdraw(amount);
            payable(data.decodeWithdrawer()).transfer(amount);
        }
    }

    /**
     * @dev Before swap callback, not supported
     */
    function beforeSwap(address, address, address, uint256, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev After swap callback, not supported
     */
    function afterSwap(address, address, address, uint256, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Before join callback, not supported
     */
    function beforeJoin(address, address, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev After join callback, not supported
     */
    function afterJoin(address, address, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Before exit callback, not supported
     */
    function beforeExit(address, address, uint256, bool, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev After exit callback, not supported
     */
    function afterExit(address, address, uint256, bool, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Before migrate callback, not supported
     */
    function beforeMigrate(address, address, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev After migrate callback, not supported
     */
    function afterMigrate(address, address, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Internal method to approve ERC20 tokens to Mimic's Vault
     * @param token Address of the ERC20 token to approve
     * @param amount Amount of tokens to approve
     */
    function _safeApprove(address token, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).safeApprove(vault, amount);
        }
    }

    /**
     * @dev Internal method to set the allowed tokens configuration. Only used in constructor.
     * @param tokens List of custom tokens to be allowed
     * @param allowed Allowed tokens configuration: only custom, custom and whitelisted, or any
     */
    function _setAllowedTokens(address[] memory tokens, Allowed allowed) private {
        allowedTokens = allowed;
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i].isContract(), 'CUSTOM_TOKEN_NOT_CONTRACT');
            isCustomToken[tokens[i]] = true;
        }
        emit AllowedTokensSet(uint256(allowed), tokens);
    }

    /**
     * @dev Internal method to set the allowed strategies configuration. Only used in constructor.
     * @param strategies List of custom strategies to be allowed
     * @param allowed Allowed strategies configuration: only custom, custom and whitelisted, or any
     */
    function _setAllowedStrategies(address[] memory strategies, Allowed allowed) private {
        allowedStrategies = allowed;
        for (uint256 i = 0; i < strategies.length; i++) {
            require(strategies[i].isContract(), 'CUSTOM_STRATEGY_NOT_CONTRACT');
            isCustomStrategy[strategies[i]] = true;
        }
        emit AllowedStrategiesSet(uint256(allowed), strategies);
    }

    /**
     * @dev Internal method to set the list of allowed managers. Only used in constructor.
     * @param managers List of managers to be allowed
     */
    function _setManagers(address[] memory managers) private {
        require(managers.length > 0, 'MISSING_MANAGERS');
        for (uint256 i = 0; i < managers.length; i++) {
            require(managers[i] != address(0), 'MANAGER_ZERO_ADDRESS');
            isManager[managers[i]] = true;
        }
        emit ManagersSet(managers);
    }

    /**
     * @dev Internal method to set the list of allowed withdrawers. Only used in constructor.
     * @param withdrawers List of withdrawers to be allowed
     */
    function _setWithdrawers(address[] memory withdrawers) private {
        require(withdrawers.length > 0, 'MISSING_WITHDRAWERS');
        for (uint256 i = 0; i < withdrawers.length; i++) {
            require(withdrawers[i] != address(0), 'WITHDRAWER_ZERO_ADDRESS');
            isWithdrawer[withdrawers[i]] = true;
        }
        emit WithdrawersSet(withdrawers);
    }

    /**
     * @dev Internal method to set fee-related params. Only used in constructor.
     * @param _feeCollector Address that will receive the manager collected fees
     * @param _depositFee Deposit fee amount
     * @param _withdrawFee Withdraw fee amount
     * @param _performanceFee Performance fee amount
     * @param _maxSwapSlippage Maximum slippage allowed by the wallet owner
     */
    function _setParams(
        address _feeCollector,
        uint256 _depositFee,
        uint256 _withdrawFee,
        uint256 _performanceFee,
        uint256 _maxSwapSlippage
    ) private {
        require(_feeCollector != address(0), 'FEE_COLLECTOR_ZERO_ADDRESS');
        feeCollector = _feeCollector;

        require(_depositFee <= MAX_DEPOSIT_FEE, 'DEPOSIT_FEE_TOO_HIGH');
        depositFee = _depositFee;

        require(_withdrawFee <= MAX_WITHDRAW_FEE, 'WITHDRAW_FEE_TOO_HIGH');
        withdrawFee = _withdrawFee;

        require(_performanceFee <= MAX_PERFORMANCE_FEE, 'PERFORMANCE_FEE_TOO_HIGH');
        performanceFee = _performanceFee;

        require(_maxSwapSlippage <= IVault(vault).maxSlippage(), 'MAX_SWAP_SLIPPAGE_TOO_HIGH');
        maxSwapSlippage = _maxSwapSlippage;

        emit ParamsSet(_feeCollector, _depositFee, _withdrawFee, _performanceFee, _maxSwapSlippage);
    }

    /**
     * @dev Internal method to set the reference to the Mimic's Vault. Only used in constructor.
     * @param _vault Mimic's vault reference to be set
     */
    function _setVault(address _vault) private {
        require(vault == address(0), 'ALREADY_INIT');
        require(_vault.isContract(), 'VAULT_NOT_CONTRACT');
        vault = _vault;
    }
}
