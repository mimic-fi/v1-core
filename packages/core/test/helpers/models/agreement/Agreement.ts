import { BigNumber, Contract } from 'ethers'
import { BigNumberish, ZERO_ADDRESS, ZERO_BYTES32 } from '@mimic-fi/v1-helpers'

import { Account, toAddress, toAddresses } from '../types'
import { Allowed, RawAgreementDeployment } from './types'

import Vault from '../vault/Vault'
import AgreementDeployer from './AgreementDeployer'

export default class Agreement {
  instance: Contract
  vault: Vault
  feeCollector: Account
  depositFee: BigNumberish
  withdrawFee: BigNumberish
  performanceFee: BigNumberish
  maxSwapSlippage: BigNumberish
  managers: Account[]
  withdrawers: Account[]
  tokens: Contract[]
  allowedTokens: Allowed
  strategies: Contract[]
  allowedStrategies: Allowed

  static async create(params: RawAgreementDeployment = {}): Promise<Agreement> {
    return AgreementDeployer.deploy(params)
  }

  constructor(
    instance: Contract,
    vault: Vault,
    feeCollector: Account,
    depositFee: BigNumberish,
    withdrawFee: BigNumberish,
    performanceFee: BigNumberish,
    maxSwapSlippage: BigNumberish,
    managers: Account[],
    withdrawers: Account[],
    tokens: Contract[],
    allowedTokens: Allowed,
    strategies: Contract[],
    allowedStrategies: Allowed
  ) {
    this.instance = instance
    this.vault = vault
    this.feeCollector = feeCollector
    this.depositFee = depositFee
    this.withdrawFee = withdrawFee
    this.performanceFee = performanceFee
    this.maxSwapSlippage = maxSwapSlippage
    this.managers = managers
    this.withdrawers = withdrawers
    this.tokens = tokens
    this.allowedTokens = allowedTokens
    this.strategies = strategies
    this.allowedStrategies = allowedStrategies
  }

  get address(): string {
    return this.instance.address
  }

  async areWithdrawers(accounts: Account[]): Promise<boolean> {
    const addresses = toAddresses(accounts)
    const results = await Promise.all(addresses.map(async (address) => await this.instance.isWithdrawer(address)))
    return results.every(Boolean)
  }

  async areManagers(accounts: Account[]): Promise<boolean> {
    const addresses = toAddresses(accounts)
    const results = await Promise.all(addresses.map(async (address) => await this.instance.isManager(address)))
    return results.every(Boolean)
  }

  async isStrategyAllowed(strategy: Account): Promise<boolean> {
    return this.instance.isStrategyAllowed(toAddress(strategy))
  }

  async isTokenAllowed(token: Account): Promise<boolean> {
    return this.instance.isTokenAllowed(toAddress(token))
  }

  async getFeeCollector(): Promise<BigNumber> {
    return this.instance.feeCollector()
  }

  async getDepositFee(): Promise<{ fee: BigNumber; collector: string }> {
    const [fee, collector] = await this.instance.getDepositFee()
    return { fee, collector }
  }

  async getWithdrawFee(): Promise<{ fee: BigNumber; collector: string }> {
    const [fee, collector] = await this.instance.getWithdrawFee()
    return { fee, collector }
  }

  async getPerformanceFee(): Promise<{ fee: BigNumber; collector: string }> {
    const [fee, collector] = await this.instance.getPerformanceFee()
    return { fee, collector }
  }

  async getMaxSwapSlippage(): Promise<BigNumber> {
    return this.instance.maxSwapSlippage()
  }

  async getSupportedCallbacks(): Promise<string> {
    return this.instance.getSupportedCallbacks()
  }

  async canDeposit(who: Account, where: Account, token?: string, amount: BigNumberish = 0): Promise<boolean> {
    const how = token ? this.vault.encodeDeposit(token, amount) : '0x'
    return this.canPerform(who, where, this.vault.getSelector('deposit'), how)
  }

  async canWithdraw(who: Account, where: Account, token?: string, amount: BigNumberish = 0, recipient = ZERO_ADDRESS): Promise<boolean> {
    const how = token ? this.vault.encodeWithdraw(token, amount, recipient) : '0x'
    return this.canPerform(who, where, this.vault.getSelector('withdraw'), how)
  }

  async canSwap(who: Account, where: Account, tokenIn?: string, tokenOut?: string, amountIn: BigNumberish = 0, slippage: BigNumberish = 0, data = '0x'): Promise<boolean> {
    const how = tokenIn && tokenOut ? this.vault.encodeSwap(tokenIn, tokenOut, amountIn, slippage, data) : '0x'
    return this.canPerform(who, where, this.vault.getSelector('swap'), how)
  }

  async canJoin(who: Account, where: Account, strategy?: string, amount: BigNumberish = 0, data = '0x'): Promise<boolean> {
    const how = strategy ? this.vault.encodeJoin(strategy, amount, data) : '0x'
    return this.canPerform(who, where, this.vault.getSelector('join'), how)
  }

  async canExit(who: Account, where: Account, strategy?: string, ratio: BigNumberish = 0, data = '0x'): Promise<boolean> {
    const how = strategy ? this.vault.encodeExit(strategy, ratio, data) : '0x'
    return this.canPerform(who, where, this.vault.getSelector('exit'), how)
  }

  async canPerform(who: Account, where: Account, what = ZERO_BYTES32, how = '0x'): Promise<boolean> {
    return this.instance.canPerform(toAddress(who), toAddress(where), what, how)
  }
}
