import { BigInt, Address, ethereum } from '@graphprotocol/graph-ts'

import { ERC20 as ERC20Contract } from '../types/Vault/ERC20'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Portfolio as PortfolioContract } from '../types/Vault/Portfolio'

import { Deposit, Withdraw, Join, Exit, Swap, ProtocolFeeSet, WhitelistedStrategySet } from '../types/Vault/Vault'
import {
  Vault as VaultEntity,
  Rate as RateEntity,
  Strategy as StrategyEntity,
  Account as AccountEntity,
  AccountBalance as AccountBalanceEntity,
  AccountStrategy as AccountStrategyEntity,
  Portfolio as PortfolioEntity,
  ERC20 as ERC20Entity
} from '../types/schema'

export const VAULT_ID = 'VAULT_ID'

export function handleDeposit(event: Deposit): void {
  loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  let tokens = event.params.tokens;
  let amounts = event.params.amounts;

  for (let i: i32 = 0; i < tokens.length; i++) {
    loadOrCreateERC20(tokens[i])
    let balance = loadOrCreateAccountBalance(event.params.account, tokens[i])
    balance.amount = balance.amount.plus(amounts[i])
    balance.save()
  }
}

export function handleWithdraw(event: Withdraw): void {
  loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  let tokens = event.params.tokens;
  let amounts = event.params.amounts;

  for (let i: i32 = 0; i < tokens.length; i++) {
    loadOrCreateERC20(tokens[i])
    let balance = loadOrCreateAccountBalance(event.params.account, tokens[i])
    balance.amount = balance.amount.minus(amounts[i])
    balance.save()
  }
}

export function handleJoin(event: Join): void {
  let vault = loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  let strategy = loadOrCreateStrategy(event.params.strategy, vault, event)
  strategy.shares = strategy.shares.plus(event.params.shares)
  strategy.save()

  let accountStrategy = loadOrCreateAccountStrategy(event.params.account, event.params.strategy)
  accountStrategy.shares = accountStrategy.shares.plus(event.params.shares)
  accountStrategy.invested = accountStrategy.shares.plus(event.params.amount)
  accountStrategy.save()

  let accountBalance = loadOrCreateAccountBalance(event.params.account, Address.fromString(strategy.token))
  accountBalance.amount = accountBalance.amount.minus(event.params.amount)
  accountBalance.save()
}

export function handleExit(event: Exit): void {
  let vault = loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  let strategy = loadOrCreateStrategy(event.params.strategy, vault, event)
  strategy.shares = strategy.shares.minus(event.params.shares)
  strategy.save()

  let accountStrategy = loadOrCreateAccountStrategy(event.params.account, event.params.strategy)
  accountStrategy.shares = accountStrategy.shares.minus(event.params.shares)
  accountStrategy.invested = accountStrategy.shares.minus(event.params.amountInvested)
  accountStrategy.save()

  let accountBalance = loadOrCreateAccountBalance(event.params.account, Address.fromString(strategy.token))
  accountBalance.amount = accountBalance.amount.plus(event.params.amountReceived)
  accountBalance.save()
}

export function handleSwap(event: Swap): void {
  loadOrCreateERC20(event.params.tokenIn)
  let balanceIn = loadOrCreateAccountBalance(event.params.account, event.params.tokenIn)
  balanceIn.amount = balanceIn.amount.minus(event.params.amountIn).plus(event.params.remainingIn)
  balanceIn.save()

  loadOrCreateERC20(event.params.tokenOut)
  let balanceOut = loadOrCreateAccountBalance(event.params.account, event.params.tokenOut)
  balanceOut.amount = balanceOut.amount.plus(event.params.amountOut)
  balanceOut.save()
}

export function handleProtocolFeeSet(event: ProtocolFeeSet): void {
  let vault = loadOrCreateVault(event.address)
  vault.protocolFee = event.params.protocolFee
  vault.save()
}

export function handleWhitelistedStrategySet(event: WhitelistedStrategySet): void {
  let vault = loadOrCreateVault(event.address)
  let strategy = loadOrCreateStrategy(event.params.strategy, vault, event)
  strategy.whitelisted = event.params.whitelisted
  strategy.save();
}

export function handleBlock(block: ethereum.Block): void {
  let vault = VaultEntity.load(VAULT_ID)
  if (vault !== null && Array.isArray(vault.strategies)) {
    let strategies = vault.strategies!;
    for (let i: i32 = 0; i < strategies.length; i++) {
      let strategy = StrategyEntity.load(strategies[i])
      if (strategy !== null) createLastRate(strategy!, block.timestamp)
    }
  }
}

function loadOrCreateVault(vaultAddress: Address): VaultEntity {
  let vault = VaultEntity.load(VAULT_ID)

  if (vault === null) {
    vault = new VaultEntity(VAULT_ID)
    vault.address = vaultAddress.toHexString()
    vault.protocolFee = BigInt.fromI32(0)
    vault.save()
  }

  return vault!
}

function loadOrCreateStrategy(strategyAddress: Address, vault: VaultEntity, event: ethereum.Event): StrategyEntity {
  let id = strategyAddress.toHexString()
  let strategy = StrategyEntity.load(id)
  let strategyContract = StrategyContract.bind(strategyAddress)

  if (strategy === null) {
    strategy = new StrategyEntity(id)
    strategy.vault = vault.id
    strategy.token = loadOrCreateERC20(strategyContract.getToken()).id
    strategy.whitelisted = false
    strategy.metadata = strategyContract.getMetadataURI()
    strategy.shares = BigInt.fromI32(0)
    strategy.deposited = BigInt.fromI32(0)
    strategy.save()
    createLastRate(strategy!, event.block.timestamp)
  }

  return strategy!
}

function createLastRate(strategy: StrategyEntity, timestamp: BigInt): void {
  let strategyContract = StrategyContract.bind(Address.fromString(strategy.id))
  let shares = strategyContract.getTotalShares()
  let value = shares.isZero() ? strategyContract.getTokenBalance().div(shares) : BigInt.fromI32(0)

  let rateId = strategy.id + '-' + timestamp.toString()
  let rate = new RateEntity(rateId)
  rate.value = value
  rate.strategy = strategy.id
  rate.timestamp = timestamp
  rate.save()

  strategy.lastRate = rateId
  strategy.deposited = shares.times(value).div(BigInt.fromString('1000000000000000000'))
  strategy.save()
}

function loadOrCreateAccount(accountAddress: Address, vaultAddress: Address): AccountEntity {
  let id = accountAddress.toHexString()
  let account = AccountEntity.load(id)

  if (account === null) {
    account = new AccountEntity(id)
    account.vault = vaultAddress.toHexString()
    account.save()
    tryDecodingPortfolio(accountAddress);
  }

  return account!
}

function loadOrCreateAccountBalance(accountAddress: Address, tokenAddress: Address): AccountBalanceEntity {
  let id = accountAddress.toHexString() + "-" + tokenAddress.toString()
  let accountBalance = AccountBalanceEntity.load(id)

  if (accountBalance === null) {
    accountBalance = new AccountBalanceEntity(id)
    accountBalance.account = accountAddress.toHexString()
    accountBalance.token = tokenAddress.toHexString()
    accountBalance.amount = BigInt.fromI32(0)
    accountBalance.save()
  }

  return accountBalance!
}

function loadOrCreateAccountStrategy(accountAddress: Address, strategyAddress: Address): AccountStrategyEntity {
  let id = accountAddress.toHexString() + "-" + strategyAddress.toString()
  let accountStrategy = AccountStrategyEntity.load(id)

  if (accountStrategy === null) {
    accountStrategy = new AccountStrategyEntity(id)
    accountStrategy.account = accountAddress.toHexString()
    accountStrategy.strategy = strategyAddress.toHexString()
    accountStrategy.shares = BigInt.fromI32(0)
    accountStrategy.invested = BigInt.fromI32(0)
    accountStrategy.save()
  }

  return accountStrategy!
}

function tryDecodingPortfolio(accountAddress: Address): void {
  let portfolioContract = PortfolioContract.bind(accountAddress)
  let depositFeeResponse = portfolioContract.try_getDepositFee()
  let performanceFeeResponse = portfolioContract.try_getPerformanceFee()

  if (!depositFeeResponse.reverted && !performanceFeeResponse.reverted) {
    let id = accountAddress.toHexString()
    let portfolio = PortfolioEntity.load(id)
    if (portfolio == null) {
      portfolio = new PortfolioEntity(id)
      portfolio.depositFee = depositFeeResponse.value.value0
      portfolio.feeCollector = depositFeeResponse.value.value1
      portfolio.performanceFee = performanceFeeResponse.value.value0
      portfolio.account = id
      portfolio.save()
    }
  }
}

function loadOrCreateERC20(address: Address): ERC20Entity {
  let id = address.toHexString()
  let erc20 = ERC20Entity.load(id)

  if (erc20 === null) {
    let erc20Contract = ERC20Contract.bind(address)
    erc20 = new ERC20Entity(id)
    erc20.name = erc20Contract.name()
    erc20.symbol = erc20Contract.symbol()
    erc20.decimals = erc20Contract.decimals()
    erc20.save()
  }

  return erc20!
}
