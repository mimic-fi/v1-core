// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../vault/Vault.sol";

contract VaultMock is Vault {
    constructor (uint256 _protocolFee, address _priceOracle, address _swapConnector, address[] memory _whitelistedTokens, address[] memory _whitelistedStrategies)
        Vault(_protocolFee, _priceOracle, _swapConnector, _whitelistedTokens, _whitelistedStrategies)
    {}

    function mockBeforeDeposit(address portfolio, address sender, address token, uint256 amount) external {
        IPortfolio(portfolio).beforeDeposit(sender, token, amount);
    }

    function mockBeforeWithdraw(address portfolio, address sender, address token, uint256 amount, address recipient) external {
        IPortfolio(portfolio).beforeWithdraw(sender, token, amount, recipient);
    }
}
