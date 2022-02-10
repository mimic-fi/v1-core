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

library Accounts {
    using FixedPoint for uint256;
    using BytesHelpers for bytes2;

    struct Data {
        uint256 id;
        address addr;
        bool isPortfolio;
        bytes2 callbacks;
    }

    function parse(address self, uint256 id) internal view returns (Data memory) {
        Data memory data;
        data.id = id;
        data.addr = self;
        data.isPortfolio = Address.isContract(self);
        data.callbacks = getSupportedCallbacks(data);
        return data;
    }

    function isSender(Data memory self) internal view returns (bool) {
        return self.addr == msg.sender;
    }

    function getTokenBalance(Data memory self, address token) internal view returns (uint256) {
        return self.isPortfolio ? IPortfolio(self.addr).getTokenBalance(token) : 0;
    }

    function getDepositFee(Data memory self, address token) internal view returns (uint256 fee, address collector) {
        return self.isPortfolio ? IPortfolio(self.addr).getDepositFee(token) : (0, address(0));
    }

    function getWithdrawFee(Data memory self, address token) internal view returns (uint256 fee, address collector) {
        return self.isPortfolio ? IPortfolio(self.addr).getWithdrawFee(token) : (0, address(0));
    }

    function getPerformanceFee(Data memory self, address strategy)
        internal
        view
        returns (uint256 fee, address collector)
    {
        return self.isPortfolio ? IPortfolio(self.addr).getPerformanceFee(strategy) : (0, address(0));
    }

    function getSupportedCallbacks(Data memory self) internal view returns (bytes2) {
        return self.isPortfolio ? IPortfolio(self.addr).getSupportedCallbacks() : bytes2(0x00);
    }

    function canPerform(Data memory self, address who, address where, bytes32 what, bytes memory how)
        internal
        view
        returns (bool)
    {
        return self.isPortfolio ? IPortfolio(self.addr).canPerform(who, where, what, how) : false;
    }

    function beforeDeposit(Data memory self, address sender, address token, uint256 amount, bytes memory data)
        internal
    {
        if (supportsBeforeDeposit(self.callbacks)) {
            IPortfolio(self.addr).beforeDeposit(sender, token, amount, data);
        }
    }

    function afterDeposit(Data memory self, address sender, address token, uint256 amount, bytes memory data) internal {
        if (supportsAfterDeposit(self.callbacks)) {
            IPortfolio(self.addr).afterDeposit(sender, token, amount, data);
        }
    }

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

    function beforeJoin(Data memory self, address sender, address strategy, uint256 amount, bytes memory data)
        internal
    {
        if (supportsBeforeJoin(self.callbacks)) {
            IPortfolio(self.addr).beforeJoin(sender, strategy, amount, data);
        }
    }

    function afterJoin(Data memory self, address sender, address strategy, uint256 amount, bytes memory data) internal {
        if (supportsAfterJoin(self.callbacks)) {
            IPortfolio(self.addr).afterJoin(sender, strategy, amount, data);
        }
    }

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

    function beforeMigrate(Data memory self, address sender, address to, bytes memory data) internal {
        if (supportsBeforeMigrate(self.callbacks)) {
            IPortfolio(self.addr).beforeMigrate(sender, to, data);
        }
    }

    function afterMigrate(Data memory self, address sender, address to, bytes memory data) internal {
        if (supportsAfterMigrate(self.callbacks)) {
            IPortfolio(self.addr).afterMigrate(sender, to, data);
        }
    }

    function supportsBeforeDeposit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(0);
    }

    function supportsAfterDeposit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(1);
    }

    function supportsBeforeWithdraw(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(2);
    }

    function supportsAfterWithdraw(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(3);
    }

    function supportsBeforeSwap(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(4);
    }

    function supportsAfterSwap(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(5);
    }

    function supportsBeforeJoin(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(6);
    }

    function supportsAfterJoin(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(7);
    }

    function supportsBeforeExit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(8);
    }

    function supportsAfterExit(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(9);
    }

    function supportsBeforeMigrate(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(10);
    }

    function supportsAfterMigrate(bytes2 self) internal pure returns (bool) {
        return self.isBitSet(11);
    }
}
