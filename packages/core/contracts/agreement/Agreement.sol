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

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../libraries/FixedPoint.sol";
import "../libraries/BytesHelpers.sol";

import "../interfaces/IAgreement.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IVault.sol";

contract Agreement is IAgreement, ReentrancyGuard {
    using Address for address;
    using SafeERC20 for IERC20;
    using FixedPoint for uint256;
    using BytesHelpers for bytes;
    using BytesHelpers for bytes4;
    using BytesHelpers for bytes32;
    using BytesHelpers for bytes32[];

    enum AllowedStrategies {
        Any,
        None,
        Whitelisted
    }

    uint256 internal constant MAX_DEPOSIT_FEE = 1e18; // 100%
    uint256 internal constant MAX_PERFORMANCE_FEE = 1e18; // 100%
    uint256 internal constant MAX_SWAP_SLIPPAGE = 1e18; // 100%

    address public override vault;
    address public override feeCollector;
    uint256 public override depositFee;
    uint256 public override performanceFee;
    uint256 public override maxSwapSlippage;

    mapping (address => bool) public override isManager;
    mapping (address => bool) public override isWithdrawer;

    address[] public customStrategies;
    AllowedStrategies public allowedStrategies;
    mapping (address => bool) public isCustomStrategy;

    modifier onlyVault() {
        require(msg.sender == vault, "SENDER_NOT_ALLOWED");
        _;
    }

    function init(
        address _vault,
        address _feeCollector,
        uint256 _depositFee,
        uint256 _performanceFee,
        uint256 _maxSwapSlippage,
        address[] memory _managers,
        address[] memory _withdrawers,
        address[] memory _customStrategies,
        AllowedStrategies _allowedStrategies
    ) external {
        require(vault == address(0), "ALREADY_INIT");
        require(_vault.isContract(), "VAULT_NOT_CONTRACT");
        vault = _vault;

        require(_depositFee <= MAX_DEPOSIT_FEE, "DEPOSIT_FEE_TOO_HIGH");
        depositFee = _depositFee;

        require(_performanceFee <= MAX_PERFORMANCE_FEE, "PERFORMANCE_FEE_TOO_HIGH");
        performanceFee = _performanceFee;

        require(_feeCollector != address(0), "FEE_COLLECTOR_ZERO_ADDRESS");
        feeCollector = _feeCollector;
        emit FeesConfigSet(_depositFee, _performanceFee, _feeCollector);

        require(_maxSwapSlippage <= MAX_SWAP_SLIPPAGE, "MAX_SWAP_SLIPPAGE_TOO_HIGH");
        maxSwapSlippage = _maxSwapSlippage;

        require(_managers.length > 0, "MISSING_MANAGERS");
        for (uint256 i = 0; i < _managers.length; i++) {
            require(_managers[i] != address(0), "MANAGER_ZERO_ADDRESS");
            isManager[_managers[i]] = true;
        }
        emit ManagersSet(_managers);

        require(_withdrawers.length > 0, "MISSING_WITHDRAWERS");
        for (uint256 i = 0; i < _withdrawers.length; i++) {
            require(_withdrawers[i] != address(0), "WITHDRAWER_ZERO_ADDRESS");
            isWithdrawer[_withdrawers[i]] = true;
        }
        emit WithdrawersSet(_withdrawers);

        for (uint256 i = 0; i < _customStrategies.length; i++) {
            require(_customStrategies[i].isContract(), "CUSTOM_STRATEGY_NOT_CONTRACT");
            isCustomStrategy[_customStrategies[i]] = true;
            customStrategies.push(_customStrategies[i]);
        }
        allowedStrategies = _allowedStrategies;
        emit StrategiesSet(uint256(_allowedStrategies), _customStrategies);
    }

    function getDepositFee() external override view returns (uint256, address) {
        return (depositFee, feeCollector);
    }

    function getPerformanceFee() external override view returns (uint256, address) {
        return (performanceFee, feeCollector);
    }

    function getBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function isSenderAllowed(address sender) public view returns (bool) {
        return isWithdrawer[sender] || isManager[sender];
    }

    function isStrategyAllowed(address strategy) public override view returns (bool) {
        if (allowedStrategies == AllowedStrategies.Any || isCustomStrategy[strategy]) {
            return true;
        }

        return allowedStrategies == AllowedStrategies.Whitelisted && IVault(vault).isStrategyWhitelisted(strategy);
    }

    function isTokenAllowed(address token) public override view returns (bool) {
        if (allowedStrategies == AllowedStrategies.Any || isCustomToken(token)) {
            return true;
        }

        return allowedStrategies == AllowedStrategies.Whitelisted && IVault(vault).isTokenWhitelisted(token);
    }

    function isCustomToken(address token) public view returns (bool) {
        for (uint256 i = 0; i < customStrategies.length; i++) {
            if (token == IStrategy(customStrategies[i]).getToken()) return true;
        }
        return false;
    }

    function canPerform(address who, address where, bytes32 what, bytes32[] memory how) external override view returns (bool) {
        // If the sender is not allowed, then it cannot perform any actions
        if (!isSenderAllowed(who)) {
            return false;
        }

        // This agreement only trusts the vault
        if (where != address(vault)) {
            return false;
        }

        // Eval different actions and parameters
        if (what.isSwap()) {
            address tokenOut = how.decodeAddress(1);
            uint256 slippage = how.decodeUint256(3);
            return isTokenAllowed(tokenOut) && slippage <= maxSwapSlippage;
        } else if (what.isJoinOrExit()) {
            return isStrategyAllowed(how.decodeAddress(0));
        } else if (what.isWithdraw()) {
            return isWithdrawer[how.decodeAddress(0)];
        } else {
            return what.isDeposit();
        }
    }

    function getSupportedCallbacks() external override pure returns (bytes2) {
        // Supported callbacks are "before deposit" and "before withdraw": 0000000101 (0x0005).
        return bytes2(0x0005);
    }

    function beforeDeposit(address /* sender */, address[] memory tokens, uint256[] memory /* amounts */) external override onlyVault {
        _approveTokens(tokens);
    }

    function afterDeposit(address /* sender */, address[] memory /* tokens */, uint256[] memory /* amounts */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeWithdraw(address /* sender */, address[] memory tokens, uint256[] memory /* amounts */, address /* recipient */) external override onlyVault {
        _approveTokens(tokens);
    }

    function afterWithdraw(address /* sender */, address[] memory /* tokens */, uint256[] memory /* amounts */, address /* recipient */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeSwap(address /* sender */, address /* tokenIn */, address /* tokenOut */, uint256 /* amountIn */, uint256 /* slippage */, bytes memory /* data */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterSwap(address /* sender */, address /* tokenIn */, address /* tokenOut */, uint256 /* amountIn */, uint256 /* slippage */, bytes memory /* data */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeJoin(address /* sender */, address /* strategy */, uint256 /* amount */, bytes memory /* data */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterJoin(address /* sender */, address /* strategy */, uint256 /* amount */, bytes memory /* data */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function beforeExit(address /* sender */, address /* strategy */, uint256 /* ratio */, bytes memory /* data */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function afterExit(address /* sender */, address /* strategy */, uint256 /* ratio */, bytes memory /* data */) external override onlyVault {
        // solhint-disable-previous-line no-empty-blocks
    }

    function _approveTokens(address[] memory tokens) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20 token = IERC20(tokens[i]);
            uint256 allowance = token.allowance(address(this), vault);
            if (allowance < FixedPoint.MAX_UINT256) {
                if (allowance > 0) {
                    // Some tokens revert when changing non-zero approvals
                    token.safeApprove(vault, 0);
                }
                token.safeApprove(vault, FixedPoint.MAX_UINT256);
            }
        }
    }
}
