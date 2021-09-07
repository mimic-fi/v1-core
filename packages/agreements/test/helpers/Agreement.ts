import { defaultAbiCoder } from '@ethersproject/abi'
import { BigNumber, Contract, utils } from 'ethers'
import { BigNumberish, getArtifact, ZERO_ADDRESS, ZERO_BYTES32 } from '@mimic-fi/v1-helpers'

import { toAddress, toAddresses, Account, Allowed, RawAgreementDeployment } from './types'

import AgreementDeployer from './AgreementDeployer'

export default class Agreement {
  instance: Contract
  vault: Contract
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
    vault: Contract,
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
    const how = token ? this.encodeDeposit(token, amount) : '0x'
    return this.canPerform(who, where, await this.getVaultActionId('deposit'), how)
  }

  async canWithdraw(who: Account, where: Account, token?: string, amount: BigNumberish = 0, recipient = ZERO_ADDRESS): Promise<boolean> {
    const how = token ? this.encodeWithdraw(token, amount, recipient) : '0x'
    return this.canPerform(who, where, await this.getVaultActionId('withdraw'), how)
  }

  async canSwap(who: Account, where: Account, tokenIn?: Account, tokenOut?: Account, amountIn: BigNumberish = 0, slippage: BigNumberish = 0, data = '0x'): Promise<boolean> {
    const how = tokenIn && tokenOut ? this.encodeSwap(toAddress(tokenIn), toAddress(tokenOut), amountIn, slippage, data) : '0x'
    return this.canPerform(who, where, await this.getVaultActionId('swap'), how)
  }

  async canJoin(who: Account, where: Account, strategy?: string, amount: BigNumberish = 0, data = '0x'): Promise<boolean> {
    const how = strategy ? this.encodeJoin(strategy, amount, data) : '0x'
    return this.canPerform(who, where, await this.getVaultActionId('join'), how)
  }

  async canExit(who: Account, where: Account, strategy?: string, ratio: BigNumberish = 0, data = '0x'): Promise<boolean> {
    const how = strategy ? this.encodeExit(strategy, ratio, data) : '0x'
    return this.canPerform(who, where, await this.getVaultActionId('exit'), how)
  }

  async canPerform(who: Account, where: Account, what = ZERO_BYTES32, how = '0x'): Promise<boolean> {
    return this.instance.canPerform(toAddress(who), toAddress(where), what, how)
  }

  async getVaultActionId(method: string): Promise<string> {
    const artifact = await getArtifact('IVault')
    const sighash = new utils.Interface(artifact.abi).getSighash(method)
    return `0x${sighash.replace('0x', '').padEnd(64, '0')}`
  }

  encodeDeposit(token: Account, amount: BigNumberish): string {
    return defaultAbiCoder.encode(['address', 'uint256'], [toAddress(token), amount])
  }

  encodeWithdraw(token: Account, amount: BigNumberish, recipient: Account): string {
    return defaultAbiCoder.encode(['address', 'uint256', 'address'], [toAddress(token), amount, toAddress(recipient)])
  }

  encodeSwap(tokenIn: Account, tokenOut: Account, amountIn: BigNumberish, slippage: BigNumberish, data: string): string {
    return defaultAbiCoder.encode(['address', 'address', 'uint256', 'uint256', 'bytes'], [toAddress(tokenIn), toAddress(tokenOut), amountIn, slippage, data])
  }

  encodeJoin(strategy: Account, amount: BigNumberish, data: string): string {
    return defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [toAddress(strategy), amount, data])
  }

  encodeExit(strategy: Account, ratio: BigNumberish, data: string): string {
    return defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [toAddress(strategy), ratio, data])
  }
}
