import { BigNumber, Contract } from 'ethers'

import { BigNumberish, ZERO_ADDRESS } from '@mimic-fi/v1-helpers'

import { Account, NAry, toAddress, toAddresses, TxParams } from '../types'
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

  async canDeposit({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('deposit'), how })
  }

  async canWithdraw({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('withdraw'), how })
  }

  async canJoinSwap({ who, where, how }: { who: Account; where: Account; how?: string[] }): Promise<boolean> {
    return this.canPerform({ who, where, what: this.vault.getSighash('joinSwap'), how })
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

  async approveTokens(tokens: Array<Account>): Promise<void> {
    await this.instance.approveTokens(toAddresses(tokens))
  }

  async withdraw(withdrawer: Account, tokens: Array<Account>, amounts: NAry<BigNumberish>, { from }: TxParams = {}): Promise<void> {
    const agreement = from ? this.instance.connect(from) : this.instance
    if (!Array.isArray(amounts)) amounts = Array(tokens.length).fill(amounts)
    await agreement.withdraw(toAddress(withdrawer), toAddresses(tokens), amounts)
  }
}
