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
import './IWETH.sol';

contract Agreement is IAgreement, ReentrancyGuard, Initializable {
    using Address for address;
    using SafeERC20 for IERC20;
    using VaultHelpers for bytes;
    using VaultHelpers for bytes32;

    enum Allowed {
        OnlyCustom,
        CustomAndWhitelisted,
        Any
    }

    uint256 internal constant MAX_DEPOSIT_FEE = 1e18; // 100%
    uint256 internal constant MAX_WITHDRAW_FEE = 1e18; // 100%
    uint256 internal constant MAX_PERFORMANCE_FEE = 1e18; // 100%

    IWETH public immutable weth;
    address public override vault;
    address public override feeCollector;
    uint256 public override depositFee;
    uint256 public override withdrawFee;
    uint256 public override performanceFee;
    uint256 public override maxSwapSlippage;

    mapping (address => bool) public override isManager;
    mapping (address => bool) public override isWithdrawer;

    Allowed public allowedTokens;
    mapping (address => bool) public isCustomToken;

    Allowed public allowedStrategies;
    mapping (address => bool) public isCustomStrategy;

    modifier onlyVault() {
        require(msg.sender == vault, 'SENDER_NOT_VAULT');
        _;
    }

    constructor(IWETH _weth) {
        weth = _weth;
    }

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

    function getTokenBalance(address token) public view override returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getDepositFee(address) external view override returns (uint256, address) {
        return (depositFee, feeCollector);
    }

    function getWithdrawFee(address) external view override returns (uint256, address) {
        return (withdrawFee, feeCollector);
    }

    function getPerformanceFee(address) external view override returns (uint256, address) {
        return (performanceFee, feeCollector);
    }

    function isTokenAllowed(address token) public view override returns (bool) {
        if (allowedTokens == Allowed.Any || isCustomToken[token]) {
            return true;
        }

        return allowedTokens == Allowed.CustomAndWhitelisted && IVault(vault).isTokenWhitelisted(token);
    }

    function isStrategyAllowed(address strategy) public view override returns (bool) {
        if (allowedStrategies == Allowed.Any || isCustomStrategy[strategy]) {
            return true;
        }

        return allowedStrategies == Allowed.CustomAndWhitelisted && IVault(vault).isStrategyWhitelisted(strategy);
    }

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
            return isTokenAllowed(params.tokenOut) && params.slippage <= maxSwapSlippage;
        } else if (what.isJoin()) {
            VaultHelpers.JoinParams memory params = how.decodeJoin();
            return isStrategyAllowed(params.strategy);
        } else if (what.isExit()) {
            VaultHelpers.ExitParams memory params = how.decodeExit();
            return !params.emergency || isWithdrawer[who];
        } else if (what.isWithdraw()) {
            VaultHelpers.WithdrawParams memory params = how.decodeWithdraw();
            return
                isWithdrawer[params.recipient] ||
                (IWETH(params.token) == weth &&
                    params.recipient == address(this) &&
                    isWithdrawer[_decodeAddress(params.data)]);
        } else {
            return what.isDeposit();
        }
    }

    function getSupportedCallbacks() external pure override returns (bytes2) {
        // Supported callbacks are 'before deposit', 'before withdraw', and 'after withdraw': 0000001101 (0x000D).
        return bytes2(0x000D);
    }

    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeDeposit(address, address token, uint256 amount, bytes memory) external override onlyVault {
        if (token == address(weth) && address(this).balance > 0) {
            weth.deposit{ value: address(this).balance }();
        }
        _safeApprove(token, amount);
    }

    function afterDeposit(address, address, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeWithdraw(address, address token, uint256 amount, address, bytes memory) external override onlyVault {
        _safeApprove(token, Math.min(amount, getTokenBalance(token)));
    }

    function afterWithdraw(address, address token, uint256 amount, address recipient, bytes memory data)
        external
        override
        onlyVault
    {
        if (token == address(weth) && amount > 0 && recipient == address(this)) {
            weth.withdraw(amount);
            payable(_decodeAddress(data)).transfer(amount);
        }
    }

    function beforeSwap(address, address, address, uint256, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterSwap(address, address, address, uint256, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeJoin(address, address, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterJoin(address, address, uint256, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeExit(address, address, uint256, bool, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterExit(address, address, uint256, bool, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeMigrate(address, address, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterMigrate(address, address, bytes memory) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function _safeApprove(address token, uint256 amount) internal {
        if (amount > 0) {
            IERC20(token).safeApprove(vault, amount);
        }
    }

    function _setAllowedTokens(address[] memory tokens, Allowed allowed) private {
        allowedTokens = allowed;
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i].isContract(), 'CUSTOM_TOKEN_NOT_CONTRACT');
            isCustomToken[tokens[i]] = true;
        }
        emit AllowedTokensSet(uint256(allowed), tokens);
    }

    function _setAllowedStrategies(address[] memory strategies, Allowed allowed) private {
        allowedStrategies = allowed;
        for (uint256 i = 0; i < strategies.length; i++) {
            require(strategies[i].isContract(), 'CUSTOM_STRATEGY_NOT_CONTRACT');
            isCustomStrategy[strategies[i]] = true;
        }
        emit AllowedStrategiesSet(uint256(allowed), strategies);
    }

    function _setManagers(address[] memory managers) private {
        require(managers.length > 0, 'MISSING_MANAGERS');
        for (uint256 i = 0; i < managers.length; i++) {
            require(managers[i] != address(0), 'MANAGER_ZERO_ADDRESS');
            isManager[managers[i]] = true;
        }
        emit ManagersSet(managers);
    }

    function _setWithdrawers(address[] memory withdrawers) private {
        require(withdrawers.length > 0, 'MISSING_WITHDRAWERS');
        for (uint256 i = 0; i < withdrawers.length; i++) {
            require(withdrawers[i] != address(0), 'WITHDRAWER_ZERO_ADDRESS');
            isWithdrawer[withdrawers[i]] = true;
        }
        emit WithdrawersSet(withdrawers);
    }

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

    function _setVault(address _vault) private {
        require(vault == address(0), 'ALREADY_INIT');
        require(_vault.isContract(), 'VAULT_NOT_CONTRACT');
        vault = _vault;
    }

    function _decodeAddress(bytes memory data) private pure returns (address result) {
        if (data.length >= 20) {
            (result) = abi.decode(data, (address));
        }
    }
}
