import { BigInt, Address, ethereum, log } from '@graphprotocol/graph-ts'

import { Vault as VaultContract } from '../types/Vault/Vault'
import { ERC20 as ERC20Contract } from '../types/Vault/ERC20'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Portfolio as PortfolioContract } from '../types/Vault/Portfolio'

import { Deposited, Withdrawn, Joined, Exited, ProtocolFeeChanged, WhitelistedStrategyChanged } from '../types/Vault/Vault'
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

export function handleDeposit(event: Deposited): void {
  loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  event.params.tokens.forEach((tokenAddress: Address) => {
    loadOrCreateERC20(tokenAddress)
    let balance = loadOrCreateAccountBalance(event.params.account, tokenAddress)
    let amount = event.params.amounts.shift();
    balance.amount = balance.amount.plus(amount)
    balance.save()
  })
}

export function handleWithdraw(event: Withdrawn): void {
  loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  event.params.tokens.forEach((tokenAddress: Address) => {
    loadOrCreateERC20(tokenAddress)
    let balance = loadOrCreateAccountBalance(event.params.account, tokenAddress)
    let amount = event.params.amounts.shift();
    balance.amount = balance.amount.minus(amount)
    balance.save()
  })
}

export function handleJoin(event: Joined): void {
  loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)
  loadOrCreateStrategy(event.params.strategy, event.address, event)

  let strategy = loadOrCreateStrategy(event.params.strategy, event.address, event)
  strategy.shares = strategy.shares.plus(event.params.shares)
  strategy.deposited = strategy.deposited.plus(event.params.amount)
  strategy.save()

  let accountStrategy = loadOrCreateAccountStrategy(event.params.account, event.params.strategy)
  accountStrategy.shares = accountStrategy.shares.plus(event.params.shares)
  accountStrategy.invested = accountStrategy.shares.plus(event.params.amount)
  accountStrategy.save()
}

export function handleExit(event: Exited): void {
  loadOrCreateVault(event.address)
  loadOrCreateAccount(event.params.account, event.address)

  let strategy = loadOrCreateStrategy(event.params.strategy, event.address, event)
  strategy.shares = strategy.shares.minus(event.params.shares)
  strategy.deposited = strategy.deposited.minus(event.params.amount)
  strategy.save()

  let accountStrategy = loadOrCreateAccountStrategy(event.params.account, event.params.strategy)
  accountStrategy.shares = accountStrategy.shares.minus(event.params.shares)
  accountStrategy.invested = accountStrategy.shares.minus(event.params.amount)
  accountStrategy.save()
}

export function handleProtocolFeeChange(event: ProtocolFeeChanged): void {
  let vault = loadOrCreateVault(event.address)
  vault.protocolFee = event.params.protocolFee
  vault.save()
}

export function handleWhitelistedStrategyChange(event: WhitelistedStrategyChanged): void {
  loadOrCreateVault(event.address)
  let strategy = loadOrCreateStrategy(event.params.strategy, event.address, event)
  strategy.whitelisted = event.params.whitelisted
  strategy.save();
}

function loadOrCreateVault(vaultAddress: Address): VaultEntity {
  let id = vaultAddress.toHexString()
  let vault = VaultEntity.load(id)

  if (vault === null) {
    let vaultContract = VaultContract.bind(vaultAddress)
    vault = new VaultEntity(id)
    vault.protocolFee = vaultContract.protocolFee()
    vault.save()
  }

  return vault!
}

function loadOrCreateStrategy(strategyAddress: Address, vaultAddress: Address, event: ethereum.Event): StrategyEntity {
  let id = strategyAddress.toHexString()
  let strategy = StrategyEntity.load(id)
  let strategyContract = StrategyContract.bind(strategyAddress)

  if (strategy === null) {
    strategy = new StrategyEntity(id)
    strategy.vault = vaultAddress.toHexString()
    strategy.token = loadOrCreateERC20(strategyContract.getToken()).id
    strategy.whitelisted = false
    strategy.metadata = strategyContract.getMetadataURI()
    strategy.shares = BigInt.fromI32(0)
    strategy.deposited = BigInt.fromI32(0)
  }

  if (strategy.lastRate == null || RateEntity.load(strategy.lastRate).timestamp != event.block.timestamp) {
    let rateId = strategyAddress.toHexString() + '-' + event.transaction.hash.toString() + '-' + event.logIndex.toString()
    let rate = new RateEntity(rateId)
    rate.strategy = strategyAddress.toHexString()
    rate.value = strategyContract.getRate()
    rate.timestamp = event.block.timestamp
    rate.save()

    strategy.lastRate = rateId
    strategy.save()
  }

  return strategy!
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

    let account = AccountEntity.load(id)
    account.portfolio = id;
    account.save()
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
