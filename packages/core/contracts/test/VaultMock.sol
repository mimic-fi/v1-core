// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../vault/Vault.sol";

contract VaultMock is Vault {
    constructor (uint256 _protocolFee, address _swapConnector, address[] memory _whitelistedStrategies)
        Vault(_protocolFee, _swapConnector, _whitelistedStrategies)
    {}

    function mockApproveTokens(address portfolio, address[] memory tokens) external {
        IPortfolio(portfolio).approveTokens(tokens);
    }
}
