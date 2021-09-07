// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenMock is ERC20 {
    constructor(string memory symbol) ERC20(symbol, symbol) {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
