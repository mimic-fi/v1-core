import { BigInt, Address, log } from '@graphprotocol/graph-ts'

import { loadOrCreateERC20 } from './ERC20'
import { loadOrCreateStrategy } from './Strategy'
import { Vault as VaultContract } from '../types/Vault/Vault'
import { Portfolio as PortfolioContract } from '../types/Vault/Portfolio'

import {
  Deposit,
  Withdraw,
  Join,
  Exit,
  Swap,
  Migrate,
  ProtocolFeeSet,
  WhitelistedTokenSet,
  WhitelistedStrategySet
} from '../types/Vault/Vault'

import {
  Vault as VaultEntity,
  Account as AccountEntity,
  AccountBalance as AccountBalanceEntity,
  AccountStrategy as AccountStrategyEntity,
  Portfolio as PortfolioEntity,
} from '../types/schema'

export const VAULT_ID = 'VAULT_ID'

let ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000')

export function handleDeposit(event: Deposit): void {
  loadOrCreateVault(event.address)
  loadOrCreateERC20(event.params.token)
  loadOrCreateAccount(event.params.account, event.address)
  let balance = loadOrCreateAccountBalance(event.params.account, event.params.token)
  balance.amount = balance.amount.plus(event.params.amount).minus(event.params.depositFee)
  balance.save()
}

export function handleWithdraw(event: Withdraw): void {
  loadOrCreateVault(event.address)
  loadOrCreateERC20(event.params.token)
  loadOrCreateAccount(event.params.account, event.address)
  let balance = loadOrCreateAccountBalance(event.params.account, event.params.token)
  balance.amount = balance.amount.minus(event.params.fromVault).minus(event.params.withdrawFee)
  balance.save()
}

export function handleJoin(event: Join): void {
  let vault = loadOrCreateVault(event.address)
  let strategy = loadOrCreateStrategy(event.params.strategy, vault, event)

  loadOrCreateAccount(event.params.account, event.address)

  let accountStrategy = loadOrCreateAccountStrategy(event.params.account, event.params.strategy)
  accountStrategy.shares = getAccountShares(event.address, event.params.account, event.params.strategy)
  accountStrategy.invested = getAccountInvested(event.address, event.params.account, event.params.strategy)
  accountStrategy.save()

  let accountBalance = loadOrCreateAccountBalance(event.params.account, Address.fromString(strategy.token))
  accountBalance.amount = accountBalance.amount.minus(event.params.amount)
  accountBalance.save()
}

export function handleExit(event: Exit): void {
  let vault = loadOrCreateVault(event.address)
  let strategy = loadOrCreateStrategy(event.params.strategy, vault, event)

  loadOrCreateAccount(event.params.account, event.address)

  let accountStrategy = loadOrCreateAccountStrategy(event.params.account, event.params.strategy)
  accountStrategy.shares = getAccountShares(event.address, event.params.account, event.params.strategy)
  accountStrategy.invested = getAccountInvested(event.address, event.params.account, event.params.strategy)
  accountStrategy.save()

  let accountBalance = loadOrCreateAccountBalance(event.params.account, Address.fromString(strategy.token))
  let amountReceived = event.params.amount.minus(event.params.protocolFee).minus(event.params.performanceFee)
  accountBalance.amount = accountBalance.amount.plus(amountReceived)
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

export function handleMigrate(event: Migrate): void {
  let account = loadOrCreateAccount(event.params.account, event.address)
  let to = loadOrCreateAccount(event.params.to, event.address)

  let balances = account.balances
  if (balances !== null) {
    for (let i: i32 = 0; i < balances.length; i++) {
      let balance = AccountBalanceEntity.load(balances![i])
      if (balance !== null) {
        balance.account = to.id
        balance.save()
      }
    }
  }

  let strategies = account.strategies
  if (strategies !== null) {
    for (let i: i32 = 0; i < strategies.length; i++) {
      let strategy = AccountStrategyEntity.load(strategies![i])
      if (strategy !== null) {
        strategy.account = to.id
        strategy.save()
      }
    }
  }
}

export function handleProtocolFeeSet(event: ProtocolFeeSet): void {
  let vault = loadOrCreateVault(event.address)
  vault.protocolFee = event.params.protocolFee
  vault.save()
}

export function handleWhitelistedTokenSet(event: WhitelistedTokenSet): void {
  let token = loadOrCreateERC20(event.params.token)
  token.whitelisted = event.params.whitelisted
  token.save()
}

export function handleWhitelistedStrategySet(event: WhitelistedStrategySet): void {
  let vault = loadOrCreateVault(event.address)
  let strategy = loadOrCreateStrategy(event.params.strategy, vault, event)
  strategy.whitelisted = event.params.whitelisted
  strategy.save()
}

function loadOrCreateVault(vaultAddress: Address): VaultEntity {
  let vault = VaultEntity.load(VAULT_ID)

  if (vault === null) {
    vault = new VaultEntity(VAULT_ID)
    vault.strategies = []
    vault.address = vaultAddress.toHexString()
    vault.maxSlippage = BigInt.fromI32(0)
    vault.protocolFee = BigInt.fromI32(0)
    vault.save()
  } else if (vault.maxSlippage.equals(BigInt.fromI32(0))) {
    vault.maxSlippage = getMaxSlippage(vaultAddress)
    vault.save()
  }

  return vault!
}

function loadOrCreateAccount(accountAddress: Address, vaultAddress: Address): AccountEntity {
  let id = accountAddress.toHexString()
  let account = AccountEntity.load(id)

  if (account === null) {
    account = new AccountEntity(id)
    account.vault = vaultAddress.toHexString()
    account.save()
    tryDecodingPortfolio(accountAddress)
  }

  return account!
}

function loadOrCreateAccountBalance(accountAddress: Address, tokenAddress: Address): AccountBalanceEntity {
  let id = accountAddress.toHexString() + "-" + tokenAddress.toHexString()
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
  let id = accountAddress.toHexString() + "-" + strategyAddress.toHexString()
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
  let depositFeeResponse = portfolioContract.try_getDepositFee(ZERO_ADDRESS)
  let withdrawFeeResponse = portfolioContract.try_getWithdrawFee(ZERO_ADDRESS)
  let performanceFeeResponse = portfolioContract.try_getPerformanceFee(ZERO_ADDRESS)

  if (!depositFeeResponse.reverted && !withdrawFeeResponse.reverted && !performanceFeeResponse.reverted) {
    let id = accountAddress.toHexString()
    let portfolio = PortfolioEntity.load(id)
    if (portfolio == null) {
      portfolio = new PortfolioEntity(id)
      portfolio.feeCollector = depositFeeResponse.value.value1
      portfolio.depositFee = depositFeeResponse.value.value0
      portfolio.withdrawFee = withdrawFeeResponse.value.value0
      portfolio.performanceFee = performanceFeeResponse.value.value0
      portfolio.account = id
      portfolio.save()
    }
  }
}

function getMaxSlippage(address: Address): BigInt {
  let vaultContract = VaultContract.bind(address)
  let maxSlippageCall = vaultContract.try_maxSlippage()

  if (!maxSlippageCall.reverted) {
    return maxSlippageCall.value
  }

  log.warning('maxSlippage() call reverted for {}', [address.toHexString()])
  return BigInt.fromI32(0)
}

function getAccountShares(vault: Address, account: Address, strategy: Address): BigInt {
  let vaultContract = VaultContract.bind(vault)
  let getAccountInvestmentCall = vaultContract.try_getAccountInvestment(account, strategy)

  if (!getAccountInvestmentCall.reverted) {
    return getAccountInvestmentCall.value.value1
  }

  log.warning(
    'getAccountInvestment() call reverted for {} and account {} and strategy {}',
    [vault.toHexString(), account.toHexString(), strategy.toHexString()]
  )
  return BigInt.fromI32(0)
}

function getAccountInvested(vault: Address, account: Address, strategy: Address): BigInt {
  let vaultContract = VaultContract.bind(vault)
  let getAccountInvestmentCall = vaultContract.try_getAccountInvestment(account, strategy)

  if (!getAccountInvestmentCall.reverted) {
    return getAccountInvestmentCall.value.value0
  }

  log.warning(
    'getAccountInvestment() call reverted for {} and account {} and strategy {}',
    [vault.toHexString(), account.toHexString(), strategy.toHexString()]
  )
  return BigInt.fromI32(0)
}
