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

    string public override name;
    address public immutable override vault;
    address public immutable override feeCollector;
    uint256 public immutable override depositFee;
    uint256 public immutable override performanceFee;

    address public immutable manager0;
    address public immutable manager1;
    address public immutable withdrawer0;
    address public immutable withdrawer1;

    uint256 public immutable customStrategies;
    address public immutable customStrategy0;
    address public immutable customStrategy1;
    address public immutable customStrategy2;
    address public immutable customStrategy3;
    address public immutable customStrategy4;
    address public immutable customStrategy5;
    address public immutable customStrategy6;
    address public immutable customStrategy7;
    AllowedStrategies public immutable allowedStrategies;

    modifier onlyVault() {
        require(msg.sender == vault, "SENDER_NOT_ALLOWED");
        _;
    }

    constructor(
        string memory _name,
        address _vault,
        uint256 _depositFee,
        uint256 _performanceFee,
        address _feeCollector,
        address[] memory _managers,
        address[] memory _withdrawers,
        AllowedStrategies _allowedStrategies,
        address[] memory _customStrategies
    ) {
        require(bytes(_name).length > 0, "AGREEMENT_EMPTY_NAME");
        name = _name;

        require(_vault.isContract(), "VAULT_NOT_CONTRACT");
        vault = _vault;

        require(_depositFee <= MAX_DEPOSIT_FEE, "DEPOSIT_FEE_TOO_HIGH");
        depositFee = _depositFee;

        require(_performanceFee <= MAX_PERFORMANCE_FEE, "PERFORMANCE_FEE_TOO_HIGH");
        performanceFee = _performanceFee;

        require(_feeCollector != address(0), "FEE_COLLECTOR_ZERO_ADDRESS");
        feeCollector = _feeCollector;
        emit FeesConfigSet(_depositFee, _performanceFee, _feeCollector);

        require(_managers.length == 2, "MUST_SPECIFY_2_MANAGERS");
        require(_managers[0] != address(0) && _managers[1] != address(0), "MANAGER_ZERO_ADDRESS");
        manager0 = _managers[0];
        manager1 = _managers[1];
        emit ManagersSet(_managers);

        require(_withdrawers.length == 2, "MUST_SPECIFY_2_WITHDRAWERS");
        require(_withdrawers[0] != address(0) && _withdrawers[1] != address(0), "WITHDRAWER_ZERO_ADDRESS");
        withdrawer0 = _withdrawers[0];
        withdrawer1 = _withdrawers[1];
        emit WithdrawersSet(_withdrawers);

        uint256 length = _customStrategies.length;
        require(length <= 8, "TOO_MANY_CUSTOM_STRATEGIES");

        allowedStrategies = _allowedStrategies;
        bool isAny = _allowedStrategies == AllowedStrategies.Any;
        require(!isAny || length == 0, "ANY_WITH_CUSTOM_STRATEGIES");

        for (uint256 i = 0; i < length; i++) {
            require(_customStrategies[i].isContract(), "CUSTOM_STRATEGY_NOT_CONTRACT");
        }

        customStrategies = length;
        customStrategy0 = isAny ? address(0) : (length > 0 ? _customStrategies[0] : address(0));
        customStrategy1 = isAny ? address(0) : (length > 1 ? _customStrategies[1] : address(0));
        customStrategy2 = isAny ? address(0) : (length > 2 ? _customStrategies[2] : address(0));
        customStrategy3 = isAny ? address(0) : (length > 3 ? _customStrategies[3] : address(0));
        customStrategy4 = isAny ? address(0) : (length > 4 ? _customStrategies[4] : address(0));
        customStrategy5 = isAny ? address(0) : (length > 5 ? _customStrategies[5] : address(0));
        customStrategy6 = isAny ? address(0) : (length > 6 ? _customStrategies[6] : address(0));
        customStrategy7 = isAny ? address(0) : (length > 7 ? _customStrategies[7] : address(0));
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

    function isManager(address account) public override view returns (bool) {
        return manager0 == account || manager1 == account;
    }

    function isWithdrawer(address account) public override view returns (bool) {
        return withdrawer0 == account || withdrawer1 == account;
    }

    function isSenderAllowed(address sender) public view returns (bool) {
        return isWithdrawer(sender) || isManager(sender);
    }

    function isStrategyAllowed(address strategy) public override view returns (bool) {
        if (allowedStrategies == AllowedStrategies.Any || isCustomStrategy(strategy)) {
            return true;
        }

        return allowedStrategies == AllowedStrategies.Whitelisted && IVault(vault).isStrategyWhitelisted(strategy);
    }

    function isCustomStrategy(address strategy) public view returns (bool) {
        if (customStrategies > 0 && strategy == customStrategy0) return true;
        if (customStrategies > 1 && strategy == customStrategy1) return true;
        if (customStrategies > 2 && strategy == customStrategy2) return true;
        if (customStrategies > 3 && strategy == customStrategy3) return true;
        if (customStrategies > 4 && strategy == customStrategy4) return true;
        if (customStrategies > 5 && strategy == customStrategy5) return true;
        if (customStrategies > 6 && strategy == customStrategy6) return true;
        if (customStrategies > 7 && strategy == customStrategy7) return true;
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
        if (what.isJoinOrExit()) {
            return isStrategyAllowed(how.decodeAddress(0));
        } else if (what.isWithdraw()) {
            return isWithdrawer(how.decodeAddress(0));
        } else {
            return what.isDeposit();
        }
    }

    function getSupportedCallbacks() external override pure returns (bytes1) {
        // Supported callbacks are "before deposit" and "before withdraw": 00000101 (0x05).
        return bytes1(0x05);
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
