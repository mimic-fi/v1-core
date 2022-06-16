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

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './FixedPoint.sol';
import './BytesHelpers.sol';
import '../interfaces/IPortfolio.sol';

/**
 * @title Accounts
 * @dev Helper account methods used internally by Mimic's Vault
 */
library Accounts {
    using FixedPoint for uint256;
    using BytesHelpers for bytes2;

    /**
     * @dev Internal data structure
     * @param id Identification number of an account
     * @param addr Address of an account
     * @param isPortfolio Tells whether an account is an EOA or a Wallet
     * @param callbacks Tells the list of callbacks supported by the account in case it is a wallet
     */
    struct Data {
        uint256 id;
        address addr;
        bool isPortfolio;
        bytes2 callbacks;
    }

    /**
     * @dev Parses an account address to build its internal data structure for further usage
     * @param self Address of the account to be parsed
     * @param id Identification number of the account to be parsed
     */
    function parse(address self, uint256 id) internal view returns (Data memory) {
        Data memory data;
        data.id = id;
        data.addr = self;
        data.isPortfolio = Address.isContract(self);
        data.callbacks = getSupportedCallbacks(data);
        return data;
    }

    /**
     * @dev Tells if the given account is the actual msg.sender
     */
    function isSender(Data memory self) internal view returns (bool) {
        return self.addr == msg.sender;
    }

    /**
     * @dev Tells the token balance of an account
     * @param self Internal data structure of the account querying the balance of
     * @param token Address of the token being queried
     */
    function getTokenBalance(Data memory self, address token) internal view returns (uint256) {
        return self.isPortfolio ? IPortfolio(self.addr).getTokenBalance(token) : 0;
    }

    /**
     * @dev Tells the deposit fee that should be charged to an account
     * @param self Internal data structure of the account depositing tokens
     * @param token Address of the token being deposited
     */
    function getDepositFee(Data memory self, address token) internal view returns (uint256 fee, address collector) {
        return self.isPortfolio ? IPortfolio(self.addr).getDepositFee(token) : (0, address(0));
    }

    /**
     * @dev Tells the withdraw fee that should be charged to an account
     * @param self Internal data structure of the account withdrawing tokens
     * @param token Address of the token being withdrawn
     */
    function getWithdrawFee(Data memory self, address token) internal view returns (uint256 fee, address collector) {
        return self.isPortfolio ? IPortfolio(self.addr).getWithdrawFee(token) : (0, address(0));
    }

    /**
     * @dev Tells the performance fee that should be charged to an account
     * @param self Internal data structure of the account querying the performance fee of
     * @param strategy Address of the strategy interacting with
     */
    function getPerformanceFee(Data memory self, address strategy)
        internal
        view
        returns (uint256 fee, address collector)
    {
        return self.isPortfolio ? IPortfolio(self.addr).getPerformanceFee(strategy) : (0, address(0));
    }

    /**
     * @dev Tells the list of supported callbacks by an account
     * @param self Internal data structure of the account querying the supported callbacks of
     */
    function getSupportedCallbacks(Data memory self) internal view returns (bytes2) {
        return self.isPortfolio ? IPortfolio(self.addr).getSupportedCallbacks() : bytes2(0x00);
    }

    /**
     * @dev Tells if a certain action is allowed by an account
     * @param self Internal data structure of the account querying the action for
     * @param who Who is trying to perform the action
     * @param where What's the contract being called to perform the action
     * @param what What's the action being performed
     * @param how The details of the action being performed
     */
    function canPerform(Data memory self, address who, address where, bytes32 what, bytes memory how)
        internal
        view
        returns (bool)
    {
        return self.isPortfolio ? IPortfolio(self.addr).canPerform(who, where, what, how) : false;
    }

    /**
     * @dev Calls before deposit callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the deposit action
     * @param token Address of the token to be deposited
     * @param amount Amount of tokens to be deposited
     * @param data Arbitrary extra data
     */
    function beforeDeposit(Data memory self, address sender, address token, uint256 amount, bytes memory data)
        internal
    {
        if (supportsBeforeDeposit(self.callbacks)) {
            IPortfolio(self.addr).beforeDeposit(sender, token, amount, data);
        }
    }

    /**
     * @dev Calls after deposit callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the deposit action
     * @param token Address of the token to be deposited
     * @param amount Amount of tokens to be deposited
     * @param data Arbitrary extra data
     */
    function afterDeposit(Data memory self, address sender, address token, uint256 amount, bytes memory data) internal {
        if (supportsAfterDeposit(self.callbacks)) {
            IPortfolio(self.addr).afterDeposit(sender, token, amount, data);
        }
    }

    /**
     * @dev Calls before withdraw callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the withdraw action
     * @param token Address of the token to be withdrawn
     * @param amount Amount of tokens to be withdrawn
     * @param recipient Address where the tokens are being transferred to
     * @param data Arbitrary extra data
     */
    function beforeWithdraw(
        Data memory self,
        address sender,
        address token,
        uint256 amount,
        address recipient,
        bytes memory data
    ) internal {
        if (supportsBeforeWithdraw(self.callbacks)) {
            IPortfolio(self.addr).beforeWithdraw(sender, token, amount, recipient, data);
        }
    }

    /**
     * @dev Calls after withdraw callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the withdraw action
     * @param token Address of the token to be withdrawn
     * @param amount Amount of tokens to be withdrawn
     * @param recipient Address where the tokens are being transferred to
     * @param data Arbitrary extra data
     */
    function afterWithdraw(
        Data memory self,
        address sender,
        address token,
        uint256 amount,
        address recipient,
        bytes memory data
    ) internal {
        if (supportsAfterWithdraw(self.callbacks)) {
            IPortfolio(self.addr).afterWithdraw(sender, token, amount, recipient, data);
        }
    }

    /**
     * @dev Calls before swap callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the swap action
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of tokenIn to be swapped
     * @param slippage Accepted slippage for the swap
     * @param data Arbitrary extra data
     */
    function beforeSwap(
        Data memory self,
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) internal {
        if (supportsBeforeSwap(self.callbacks)) {
            IPortfolio(self.addr).beforeSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
        }
    }

    /**
     * @dev Calls after swap callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the swap action
     * @param tokenIn Token to be sent
     * @param tokenOut Token to be received
     * @param amountIn Amount of tokenIn to be swapped
     * @param slippage Accepted slippage for the swap
     * @param data Arbitrary extra data
     */
    function afterSwap(
        Data memory self,
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippage,
        bytes memory data
    ) internal {
        if (supportsAfterSwap(self.callbacks)) {
            IPortfolio(self.addr).afterSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
        }
    }

    /**
     * @dev Calls before join callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the join action
     * @param strategy Strategy to be joined
     * @param amount Amount of strategy tokens to join with
     * @param data Arbitrary extra data
     */
    function beforeJoin(Data memory self, address sender, address strategy, uint256 amount, bytes memory data)
        internal
    {
        if (supportsBeforeJoin(self.callbacks)) {
            IPortfolio(self.addr).beforeJoin(sender, strategy, amount, data);
        }
    }

    /**
     * @dev Calls after join callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the join action
     * @param strategy Strategy to be joined
     * @param amount Amount of strategy tokens to join with
     * @param data Arbitrary extra data
     */
    function afterJoin(Data memory self, address sender, address strategy, uint256 amount, bytes memory data) internal {
        if (supportsAfterJoin(self.callbacks)) {
            IPortfolio(self.addr).afterJoin(sender, strategy, amount, data);
        }
    }

    /**
     * @dev Calls before exit callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the exit action
     * @param strategy Strategy to be exited
     * @param ratio Ratio of shares to exit with
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     */
    function beforeExit(
        Data memory self,
        address sender,
        address strategy,
        uint256 ratio,
        bool emergency,
        bytes memory data
    ) internal {
        if (supportsBeforeExit(self.callbacks)) {
            IPortfolio(self.addr).beforeExit(sender, strategy, ratio, emergency, data);
        }
    }

    /**
     * @dev Calls after exit callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the exit action
     * @param strategy Strategy to be exited
     * @param ratio Ratio of shares to exit with
     * @param emergency Whether the exit is an emergency exit or not
     * @param data Arbitrary extra data
     */
    function afterExit(
        Data memory self,
        address sender,
        address strategy,
        uint256 ratio,
        bool emergency,
        bytes memory data
    ) internal {
        if (supportsAfterExit(self.callbacks)) {
            IPortfolio(self.addr).afterExit(sender, strategy, ratio, emergency, data);
        }
    }

    /**
     * @dev Calls before migrate callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the migrate action
     * @param to Address of the account migrating to
     * @param data Arbitrary extra data
     */
    function beforeMigrate(Data memory self, address sender, address to, bytes memory data) internal {
        if (supportsBeforeMigrate(self.callbacks)) {
            IPortfolio(self.addr).beforeMigrate(sender, to, data);
        }
    }

    /**
     * @dev Calls after migrate callback if necessary
     * @param self Internal data structure of the account that will receive the call in case it supports it
     * @param sender Account calling the migrate action
     * @param to Address of the account migrating to
     * @param data Arbitrary extra data
     */
    function afterMigrate(Data memory self, address sender, address to, bytes memory data) internal {
        if (supportsAfterMigrate(self.callbacks)) {
            IPortfolio(self.addr).afterMigrate(sender, to, data);
        }
    }

    /**
     * @dev Tells whether a bitmap allows beforeDeposit callback: least significant bit #0.
     */
    function supportsBeforeDeposit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(0);
    }

    /**
     * @dev Tells whether a bitmap allows afterDeposit callback: least significant bit #1.
     */
    function supportsAfterDeposit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(1);
    }

    /**
     * @dev Tells whether a bitmap allows beforeWithdraw callback: least significant bit #2.
     */
    function supportsBeforeWithdraw(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(2);
    }

    /**
     * @dev Tells whether a bitmap allows afterWithdraw callback: least significant bit #3.
     */
    function supportsAfterWithdraw(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(3);
    }

    /**
     * @dev Tells whether a bitmap allows beforeSwap callback: least significant bit #4.
     */
    function supportsBeforeSwap(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(4);
    }

    /**
     * @dev Tells whether a bitmap allows afterSwap callback: least significant bit #5.
     */
    function supportsAfterSwap(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(5);
    }

    /**
     * @dev Tells whether a bitmap allows beforeJoin callback: least significant bit #6.
     */
    function supportsBeforeJoin(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(6);
    }

    /**
     * @dev Tells whether a bitmap allows afterJoin callback: least significant bit #7.
     */
    function supportsAfterJoin(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(7);
    }

    /**
     * @dev Tells whether a bitmap allows beforeExit callback: least significant bit #8.
     */
    function supportsBeforeExit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(8);
    }

    /**
     * @dev Tells whether a bitmap allows afterExit callback: least significant bit #9.
     */
    function supportsAfterExit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(9);
    }

    /**
     * @dev Tells whether a bitmap allows beforeMigrate callback: least significant bit #10.
     */
    function supportsBeforeMigrate(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(10);
    }

    /**
     * @dev Tells whether a bitmap allows afterMigrate callback: least significant bit #11.
     */
    function supportsAfterMigrate(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(11);
    }
}
