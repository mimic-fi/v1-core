import { BigNumber } from 'ethers'
import { BigNumberish } from '@mimic-fi/v1-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, ContractTransaction } from 'ethers'

import { RawVaultDeployment } from './type'

import VaultDeployer from './VaultDeployer'
import { NAry, Account, TxParams, toAddresses, toAddress } from '../types'

export default class Vault {
  instance: Contract
  swapConnector: Contract
  protocolFee: BigNumberish
  strategies: Contract[]
  admin: SignerWithAddress

  static async create(params: RawVaultDeployment = {}): Promise<Vault> {
    return VaultDeployer.deploy(params)
  }

  constructor(instance: Contract, swapConnector: Contract, protocolFee: BigNumberish, strategies: Contract[], admin: SignerWithAddress) {
    this.instance = instance
    this.swapConnector = swapConnector
    this.protocolFee = protocolFee
    this.strategies = strategies
    this.admin = admin
  }

  get address(): string {
    return this.instance.address
  }

  getSighash(method: string): string {
    return this.instance.interface.getSighash(method)
  }

  async getProtocolFee(): Promise<BigNumber> {
    return this.instance.protocolFee()
  }

  async getSwapConnector(): Promise<BigNumber> {
    return this.instance.swapConnector()
  }

  async isStrategyWhitelisted(strategy: Account): Promise<boolean> {
    return this.instance.isStrategyWhitelisted(toAddress(strategy))
  }

  async getAccountBalance(account: Account, token: Account): Promise<BigNumber> {
    return this.instance.getAccountBalance(toAddress(account), toAddress(token))
  }

  async getAccountInvestment(account: Account, strategy: Account): Promise<{ shares: BigNumber; invested: BigNumber }> {
    return this.instance.getAccountInvestment(toAddress(account), toAddress(strategy))
  }

  async deposit(account: Account, tokens: NAry<Account>, amounts: NAry<BigNumberish>, { from }: TxParams = {}): Promise<ContractTransaction> {
    if (!Array.isArray(tokens)) tokens = [tokens]
    amounts = !Array.isArray(amounts) ? Array(tokens.length).fill(amounts) : amounts
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.deposit(toAddress(account), toAddresses(tokens), amounts)
  }

  async withdraw(account: Account, tokens: NAry<Account>, amounts: NAry<BigNumberish>, recipient: Account, { from }: TxParams = {}): Promise<ContractTransaction> {
    if (!Array.isArray(tokens)) tokens = [tokens]
    amounts = !Array.isArray(amounts) ? Array(tokens.length).fill(amounts) : amounts
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.withdraw(toAddress(account), toAddresses(tokens), amounts, toAddress(recipient))
  }

  async join(account: Account, strategy: Account, amount: BigNumberish, dataOrParams: string | TxParams = '0x', params: TxParams = {}): Promise<ContractTransaction> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.join(toAddress(account), toAddress(strategy), amount, data)
  }

  async joinSwap(
    account: Account,
    strategy: Account,
    amount: BigNumberish,
    token: Account,
    minAmountOut: BigNumberish,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<ContractTransaction> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.joinSwap(toAddress(account), toAddress(strategy), toAddress(token), amount, minAmountOut, data)
  }

  async exit(account: Account, strategy: Account, ratio: BigNumberish, dataOrParams: string | TxParams = '0x', params: TxParams = {}): Promise<ContractTransaction> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.exit(toAddress(account), toAddress(strategy), ratio, data)
  }

  async setProtocolFee(fee: BigNumberish, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = this.instance.connect(from || this.admin)
    return vault.setProtocolFee(fee)
  }

  async setSwapConnector(connector: Account, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = this.instance.connect(from || this.admin)
    return vault.setSwapConnector(toAddress(connector))
  }

  async setWhitelistedStrategies(strategies: NAry<Account>, whitelisted?: NAry<boolean>, { from }: TxParams = {}): Promise<ContractTransaction> {
    if (!Array.isArray(strategies)) strategies = [strategies]
    if (!whitelisted) whitelisted = Array(strategies.length).fill(true)
    const vault = this.instance.connect(from || this.admin)
    return vault.setWhitelistedStrategies(toAddresses(strategies), whitelisted)
  }
}
