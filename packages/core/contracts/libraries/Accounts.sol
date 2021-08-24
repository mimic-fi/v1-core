
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

import "@openzeppelin/contracts/utils/Address.sol";

import "./BytesHelpers.sol";
import "../interfaces/IPortfolio.sol";

library Accounts {
    using BytesHelpers for bytes2;

    struct Data {
        address addr;
        bool isPortfolio;
        bytes2 callbacks;
    }

    function parse(address self) internal view returns (Data memory) {
        Data memory data;
        data.addr = self;
        data.isPortfolio = Address.isContract(self);
        data.callbacks = getSupportedCallbacks(data);
        return data;
    }

    function isSender(Data memory self) internal view returns (bool) {
        return self.addr == msg.sender;
    }

    function getPerformanceFee(Data memory self) internal view returns (uint256 fee, address collector) {
        return self.isPortfolio ? IPortfolio(self.addr).getPerformanceFee() : (0, address(0));
    }

    function getDepositFee(Data memory self) internal view returns (uint256 fee, address collector) {
        return self.isPortfolio ? IPortfolio(self.addr).getDepositFee() : (0, address(0));
    }

    function getSupportedCallbacks(Data memory self) internal view returns (bytes2) {
        return self.isPortfolio ? IPortfolio(self.addr).getSupportedCallbacks() : bytes2(0x00);
    }

    function canPerform(Data memory self, address who, address where, bytes32 what, bytes32[] memory how) internal view returns (bool) {
        return self.isPortfolio ? IPortfolio(self.addr).canPerform(who, where, what, how) : false;
    }

    function beforeDeposit(Data memory self, address sender, address[] memory tokens, uint256[] memory amounts) internal {
        if (self.callbacks.supportsBeforeDeposit()) {
            IPortfolio(self.addr).beforeDeposit(sender, tokens, amounts);
        }
    }

    function afterDeposit(Data memory self, address sender, address[] memory tokens, uint256[] memory amounts) internal {
        if (self.callbacks.supportsAfterDeposit()) {
            IPortfolio(self.addr).afterDeposit(sender, tokens, amounts);
        }
    }

    function beforeWithdraw(Data memory self, address sender, address[] memory tokens, uint256[] memory amounts, address recipient) internal {
        if (self.callbacks.supportsBeforeWithdraw()) {
            IPortfolio(self.addr).beforeWithdraw(sender, tokens, amounts, recipient);
        }
    }

    function afterWithdraw(Data memory self, address sender, address[] memory tokens, uint256[] memory amounts, address recipient) internal {
        if (self.callbacks.supportsAfterWithdraw()) {
            IPortfolio(self.addr).afterWithdraw(sender, tokens, amounts, recipient);
        }
    }

    function beforeSwap(Data memory self, address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) internal {
        if (self.callbacks.supportsBeforeSwap()) {
            IPortfolio(self.addr).beforeSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
        }
    }

    function afterSwap(Data memory self, address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 slippage, bytes memory data) internal {
        if (self.callbacks.supportsAfterSwap()) {
            IPortfolio(self.addr).afterSwap(sender, tokenIn, tokenOut, amountIn, slippage, data);
        }
    }

    function beforeJoin(Data memory self, address sender, address strategy, uint256 amount, bytes memory data) internal {
        if (self.callbacks.supportsBeforeJoin()) {
            IPortfolio(self.addr).beforeJoin(sender, strategy, amount, data);
        }
    }

    function afterJoin(Data memory self, address sender, address strategy, uint256 amount, bytes memory data) internal {
        if (self.callbacks.supportsAfterJoin()) {
            IPortfolio(self.addr).afterJoin(sender, strategy, amount, data);
        }
    }

    function beforeExit(Data memory self, address sender, address strategy, uint256 ratio, bytes memory data) internal {
        if (self.callbacks.supportsBeforeExit()) {
            IPortfolio(self.addr).beforeExit(sender, strategy, ratio, data);
        }
    }

    function afterExit(Data memory self, address sender, address strategy, uint256 ratio, bytes memory data) internal {
        if (self.callbacks.supportsAfterExit()) {
            IPortfolio(self.addr).afterExit(sender, strategy, ratio, data);
        }
    }
}
