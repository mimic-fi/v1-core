import { BigNumber } from 'ethers'
import { BigNumberish } from '@mimic-fi/v1-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, ContractTransaction } from 'ethers'

import { RawVaultDeployment } from './type'
import { NAry, Account, TxParams, toAddresses, toAddress } from '../types'

import Token from '../tokens/Token'
import TokenList from '../tokens/TokenList'
import VaultDeployer from './VaultDeployer'

export default class Vault {
  instance: Contract
  priceOracle: Contract
  swapConnector: Contract
  protocolFee: BigNumberish
  tokens: Contract[]
  strategies: Contract[]
  admin: SignerWithAddress

  static async create(params: RawVaultDeployment = {}): Promise<Vault> {
    return VaultDeployer.deploy(params)
  }

  constructor(instance: Contract, priceOracle: Contract, swapConnector: Contract, protocolFee: BigNumberish, tokens: Contract[], strategies: Contract[], admin: SignerWithAddress) {
    this.instance = instance
    this.priceOracle = priceOracle
    this.swapConnector = swapConnector
    this.protocolFee = protocolFee
    this.tokens = tokens
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

  async getPriceOracle(): Promise<string> {
    return this.instance.priceOracle()
  }

  async getSwapConnector(): Promise<string> {
    return this.instance.swapConnector()
  }

  async isStrategyWhitelisted(strategy: Account): Promise<boolean> {
    return this.instance.isStrategyWhitelisted(toAddress(strategy))
  }

  async isTokenWhitelisted(token: Token): Promise<boolean> {
    return this.instance.isTokenWhitelisted(token.address)
  }

  async getAccountBalance(account: Account, token: Account): Promise<BigNumber> {
    return this.instance.getAccountBalance(toAddress(account), toAddress(token))
  }

  async getAccountInvestment(account: Account, strategy: Account): Promise<{ shares: BigNumber; invested: BigNumber }> {
    return this.instance.getAccountInvestment(toAddress(account), toAddress(strategy))
  }

  async deposit(account: Account, token: Account, amount: BigNumberish, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.deposit(toAddress(account), toAddress(token), amount)
  }

  async withdraw(account: Account, token: Account, amount: BigNumberish, recipient: Account, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.withdraw(toAddress(account), toAddress(token), amount, toAddress(recipient))
  }

  async join(account: Account, strategy: Account, amount: BigNumberish, dataOrParams: string | TxParams = '0x', params: TxParams = {}): Promise<ContractTransaction> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.join(toAddress(account), toAddress(strategy), amount, data)
  }

  async swap(
    account: Account,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: BigNumberish,
    slippage: BigNumberish,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<ContractTransaction> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.swap(toAddress(account), tokenIn.address, tokenOut.address, amountIn, slippage, data)
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

  async setPriceOracle(oracle: Account, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = this.instance.connect(from || this.admin)
    return vault.setPriceOracle(toAddress(oracle))
  }

  async setSwapConnector(connector: Account, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = this.instance.connect(from || this.admin)
    return vault.setSwapConnector(toAddress(connector))
  }

  async setWhitelistedTokens(tokens: TokenList, whitelisted?: NAry<boolean>, { from }: TxParams = {}): Promise<ContractTransaction> {
    if (!whitelisted) whitelisted = Array(tokens.length).fill(true)
    const vault = this.instance.connect(from || this.admin)
    return vault.setWhitelistedTokens(tokens.addresses, whitelisted)
  }

  async setWhitelistedStrategies(strategies: NAry<Account>, whitelisted?: NAry<boolean>, { from }: TxParams = {}): Promise<ContractTransaction> {
    if (!Array.isArray(strategies)) strategies = [strategies]
    if (!whitelisted) whitelisted = Array(strategies.length).fill(true)
    const vault = this.instance.connect(from || this.admin)
    return vault.setWhitelistedStrategies(toAddresses(strategies), whitelisted)
  }
}
