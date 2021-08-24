import { BigNumber, Contract, utils } from 'ethers'
import { BigNumberish, ZERO_ADDRESS } from '@mimic-fi/v1-helpers'

import { Account, toAddress, toAddresses } from '../types'
import { AllowedStrategies, RawAgreementDeployment } from './types'

import Vault from '../vault/Vault'
import AgreementDeployer from './AgreementDeployer'

export default class Agreement {
  instance: Contract
  name: string
  vault: Vault
  depositFee: BigNumberish
  performanceFee: BigNumberish
  feeCollector: Account
  maxSwapSlippage: BigNumberish
  managers: Account[]
  withdrawers: Account[]
  allowedStrategies: AllowedStrategies
  strategies: Contract[]

  static async create(params: RawAgreementDeployment = {}): Promise<Agreement> {
    return AgreementDeployer.deploy(params)
  }

  constructor(
    instance: Contract,
    name: string,
    vault: Vault,
    depositFee: BigNumberish,
    performanceFee: BigNumberish,
    feeCollector: Account,
    maxSwapSlippage: BigNumberish,
    managers: Account[],
    withdrawers: Account[],
    allowedStrategies: AllowedStrategies,
    strategies: Contract[]
  ) {
    this.instance = instance
    this.name = name
    this.vault = vault
    this.depositFee = depositFee
    this.performanceFee = performanceFee
    this.feeCollector = feeCollector
    this.maxSwapSlippage = maxSwapSlippage
    this.managers = managers
    this.withdrawers = withdrawers
    this.allowedStrategies = allowedStrategies
    this.strategies = strategies
  }

  get address(): string {
    return this.instance.address
  }

  get withdrawer0(): string {
    return toAddress(this.withdrawers[0])
  }

  get withdrawer1(): string {
    return toAddress(this.withdrawers[1])
  }

  get manager0(): string {
    return toAddress(this.managers[0])
  }

  get manager1(): string {
    return toAddress(this.managers[1])
  }

  async getWithdrawers(): Promise<string[]> {
    const withdrawer0 = await this.instance.withdrawer0()
    const withdrawer1 = await this.instance.withdrawer1()
    return [withdrawer0, withdrawer1]
  }

  async getManagers(): Promise<string[]> {
    const manager0 = await this.instance.manager0()
    const manager1 = await this.instance.manager1()
    return [manager0, manager1]
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

  async areAllowedSenders(accounts: Account[]): Promise<boolean> {
    const addresses = toAddresses(accounts)
    const results = await Promise.all(addresses.map(async (address) => await this.instance.isSenderAllowed(address)))
    return results.every(Boolean)
  }

  async isStrategyAllowed(strategy: Account): Promise<boolean> {
    return this.instance.isStrategyAllowed(toAddress(strategy))
  }

  async isTokenAllowed(token: Account): Promise<boolean> {
    return this.instance.isTokenAllowed(toAddress(token))
  }

  async getDepositFee(): Promise<{ fee: BigNumber; collector: string }> {
    const [fee, collector] = await this.instance.getDepositFee()
    return { fee, collector }
  }

  async getPerformanceFee(): Promise<{ fee: BigNumber; collector: string }> {
    const [fee, collector] = await this.instance.getPerformanceFee()
    return { fee, collector }
  }

  async getFeeCollector(): Promise<BigNumber> {
    return this.instance.feeCollector()
  }

  async getMaxSwapSlippage(): Promise<BigNumber> {
    return this.instance.maxSwapSlippage()
  }

  async getSupportedCallbacks(): Promise<string> {
    return this.instance.getSupportedCallbacks()
  }

  async canDeposit({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('deposit'), how })
  }

  async canWithdraw({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('withdraw'), how })
  }

  async canSwap({ who, where, how }: { who: Account; where: Account; how?: Array<string | BigNumberish> }): Promise<boolean> {
    const parsedHow = how ? how.map((h) => (typeof h === 'string' ? h : utils.hexZeroPad(utils.hexlify(h), 32))) : []
    return this.canPerform({ who, where, what: this.vault.getSighash('swap'), how: parsedHow })
  }

  async canJoin({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('join'), how })
  }

  async canExit({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('exit'), how })
  }

  async canPerform({ who, where, what, how }: { who: Account; where: Account; what?: string; how?: string[] }): Promise<boolean> {
    const padRight = (s: string) => `0x${s.replace('0x', '').padEnd(64, '0')}`
    what = padRight(what ?? ZERO_ADDRESS)
    how = (how ?? []).map(padRight)
    return this.instance.canPerform(toAddress(who), toAddress(where), what, how)
  }
}
