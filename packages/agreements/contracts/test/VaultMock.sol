// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import '@mimic-fi/v1-vault/contracts/interfaces/IPortfolio.sol';

contract VaultMock {
    mapping (address => bool) public isTokenWhitelisted;
    mapping (address => bool) public isStrategyWhitelisted;

    function mockWhitelistedTokens(address[] memory tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            isTokenWhitelisted[tokens[i]] = true;
        }
    }

    function mockWhitelistedStrategies(address[] memory strategies) external {
        for (uint256 i = 0; i < strategies.length; i++) {
            isStrategyWhitelisted[strategies[i]] = true;
        }
    }

    function mockBeforeDeposit(address portfolio, address sender, address token, uint256 amount) external {
        IPortfolio(portfolio).beforeDeposit(sender, token, amount);
    }

    function mockBeforeWithdraw(address portfolio, address sender, address token, uint256 amount, address recipient)
        external
    {
        IPortfolio(portfolio).beforeWithdraw(sender, token, amount, recipient);
    }
}
