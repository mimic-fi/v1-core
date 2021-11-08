// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TokenMock is ERC20 {
    constructor() ERC20('Token', 'TKN') {
        // solhint-disable-previous-line no-empty-blocks
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
