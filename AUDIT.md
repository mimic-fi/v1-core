## 1. Critical

None.

## 2. High

None. 

## 3. Medium

### 3.1. `minAmountOut` value being only calculated on-chain

In the `Vault.sol` contract, during the [`_swap` internal function](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L265-L306) the `minAmountOut` variable sent to the `Swap Connector` [is being retrieved by the Price Oracle](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L285) and [compared to the `getAmountOut` function of the swap connector](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L287). 

If an attacker can manipulate the results returned by the Price oracle and the underlying pool in a previous transaction of the same block where the swap is being made, this could result in a loss of funds when the swap is executed. 

Consider creating a parameter in the `swap` function saving the minimum amount that the sender of the transaction wants to retrieve from the swap and validate that both the `minAmountOut` variable and the result of the `getAmountOut` function are more than this parameter calculated off-chain.

#### Action

We do understand the side effects of this approach. However, having a slippage provides more flexibility allowing the user not to provide a specific amount out on every swap, for instance chaining actions. 

Note that avoiding the Price Oracle will not guarantee the user won't be affected, since the Price Oracle instance in the Vault is controlled by the same entity that controls the Swap Connector.  

## 4. Low 

### 4.1. Discrepancies between the oracle and the Swap connectors may create failure conditions 

In the `Vault.sol` contract, during the [`_swap` internal function](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L265-L306) the `minAmountOut` variable sent to the `Swap Connector` [is being retrieved by the Price Oracle](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L285) and [compared to the `getAmountOut` function of the swap connector](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L287)

If the used Oracle in the protocol returns different rates than the swap connector used for a long time, it won't be possible for anyone to trade until these two data points are congruent with each other. In periods of high volatility this could create a bottleneck for managers in the protocol to perform swaps. 

Consider making an extensive backtest analysis on the discrepancies between these two data points to understand how probable the circumstances explained in this issue are and whether it is needed to change the current logic of the smart contracts.

#### Action

We do understand this is a consequence of the approach chosen for the implementation as explained in the issue above. 

However, both the Price Oracle and the Swap Connector are implemented using widely adopted and tested protocols, Chainlink and Uniswap V2 respectively.

In case this two differ a lot, it will mean probably an edge case (unbalanced pools, a fast price increase or decrease, etc) we will protecting our users from. 

### 4.2. Cognitive dissonance in smart contract logic

The `Agreements.sol` contract validates that the tokens and strategies are allowed [when different actions are taking place](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L137-L145). However, both [`isTokenAllowed`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#104-L110) and [`isStrategyAllowed`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L112-L118) functions only validate that a custom token or strategy is written in `isCustomToken` or `isCustomStrategy` mappings respectively when the `allowedTokens` and/or `allowedStrategies` are set to `None`.

As such, is it possible for the Agreement contract to save in the `allowedTokens` and `allowedStrategies` variables, an `Allowed` enum with `None` value, but still allow the different custom tokens and strategies that are settled in the `isCustomToken` and `isCustomStrategy` mappings.

This behavior creates a cognitive dissonance on the smart contract variables, which could create problems in protocols integrating with Mimic, since querying for the `allowedTokens` and `allowedStrategies` will result in a `None` value and the agreements can still use tokens and strategies nonetheless.

Consider modifying the contract logic to not allow the usage of custom tokens or strategies when `allowedTokens` or `allowedStrategies` are set to `None`.

#### Action

Addressed in [6df3a4130a74625c9482c99606ae901217b2](https://github.com/mimic-fi/core/commit/6df3a4130a74625c9482c99606ae901217b2)

### 4.3. Default enumerator value is not set to `None`

The `Agreements.sol` contract implements the [`Allowed` enum](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L34-L38) to be able to save in the `allowedTokens` and `allowedStrategies` what kind of tokens and strategies the agreement implements. 

The default value of enumerators is always the first value set in the Enum, which in this case is `Any`. Per security considerations, it is recommended that the default value is always a secure default which in this case would be the `None` value, which will not allow the agreement to use unsafe tokens or strategies as `Any` would.

Consider modifying the order of the values in the enumerator to make `None` the default value.

#### Action

Addressed in [a451d193086f600416f95a89cdf309a74fab01c0](https://github.com/mimic-fi/core/commit/a451d193086f600416f95a89cdf309a74fab01c0)

### 4.4. Excessive slippage constants

Both in the [`Vault.sol`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L40) and [`Agreements.sol`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L44) contracts, there are constants setting the maximum slippage value as 100%. 

Consider lowering the maximum slippage value to reduce the possibilities of human error which may result in loss of funds. Moreover, consider creating a specific emergency maximum slippage value to allow for trades with huge slippage under extreme circumstances.

#### Action

Addressed in [54dc5f03707077b33a35224c175a0f67773a499b](https://github.com/mimic-fi/core/commit/54dc5f03707077b33a35224c175a0f67773a499b)

## 5. Notes 

### 5.1. Names are not unique in `AgreementFactory.sol`

The `AgreementFactory.sol` contract does not verify that the names of the child `Agreement` contracts are unique. 

Even though there are no smart contract risks associated with this behavior, this could create replicated agreements name in the frontend of the Mimic protocol, which could be abused by malicious actors by crafting rogue copies of agreements.

Consider creating a visual distinction in the UI between agreements with the same name so that malicious actors cannot create rogue duplicates of honest agreements.

#### Action

We are not planning to use Agreement's name as a unique identifier. Moreover, this can be implemented off-chain later on if needed.

For now, this is considered additional information users can play with to personalize their agreements. 

### 5.2. [`_setAllowedTokens`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L206-L213) and [`_setAllowedStrategies`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L215-L222) functions allow duplicated items

In the `Agreements.sol` contract, the [`_setAllowedTokens`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L206-L213) and [`_setAllowedStrategies`](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L215-L222) functions are used to whitelist tokens and strategies. 

These functions handle the ability to constantly overwrite the `isCustomToken` and `isCustomStrategy` mapping's value with different values in the same call.

Even though this behavior does not introduce security risks, it would allow for excessive gas consumption. 

Consider validating that the `isCustomToken` and `isCustomStrategy` are only written once per transaction

#### Action

Since these methods are restricted to governance and given that checking items in the array are not trivial in Solidity, we bet for simplicity here.

### 5.3. Excessive gas consumption on exit from the vault

The `Vault.sol` contract performs two different transfers in the internal [`_payExitFees` function](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/Vault.sol#L359-L375) when the `exit` function is called. 

Even though this behavior does not present security risks, it creates excessive costs for users.

Consider implementing changes to allow for the fees to be retrieved by the `feeCollector` and the owner of the Vault contract instead of being sent each time a user exits the protocol.

#### Action

In order to implement this we will need to track at least two fee accountings, one for the protocol and another for the fee collector. Note this is not a huge improvement compared to updating two token balances considering the new gas charging strategies for SLOAD. Therefore, we bet for simplicity here. 

### 5.4. Lack of indexed parameters in events

The `PriceOracleSet` and `SwapConnectorSet` events of the [`IVault.sol` contract](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/vault/contracts/interfaces/IVault.sol#L17-L21) and the `ManagersSet`, `WithdrawersSet`, `AllowedTokensSet`, `AllowedStrategiesSet` and `ParamsSet` of the [`IAgreement` contract](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/IAgreement.sol#L19-L30) are lacking indexed parameters.

Consider indexing event parameters to avoid hindering the task of off-chain services searching and filtering for specific events.

#### Action

Fixes regarding Vault's events were addressed in [2f05ea7422ca0e9b40152e81b4be17f7dfa2653a](https://github.com/mimic-fi/core/commit/2f05ea7422ca0e9b40152e81b4be17f7dfa2653a).

We decided not to index Agreement's events to avoid spending extra gas when creating these since their settings cannot be modified after creation and users will have to pay for it. 

### 5.5. Agreement contract missing initializer modifier

The `Agreement.sol` contract makes use of a proxy pattern which replaces the constructor with an [`initialize` external function](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L67-L87). 

In the current state of the project, this is not a security concern since the contract cannot be initialized again because of the conditions in the [internal `_setVault` function](https://github.com/mimic-fi/core/blob/7bbd780e77900411b1b224e67c8c7f0c2e1170c6/packages/agreements/contracts/Agreement.sol#L267-L271). However, if any of those two `require` conditions are removed from the codebase, each agreement could be initialized by anyone anytime.

Consider adding the battle-tested [`initializer` modifier](https://github.com/OpenZeppelin/openzeppelin-sdk/blob/7d96de7248ae2e7e81a743513ccc617a2e6bba21/packages/lib/contracts/Initializable.sol#L31-L45) to restrict the initialization to only execute once.

#### Action

Addressed in [fbbd58271b16cd1169b7f277e8a69140189e9e8d](https://github.com/mimic-fi/core/commit/fbbd58271b16cd1169b7f277e8a69140189e9e8d)
