import { defaultAbiCoder } from '@ethersproject/abi'
import { BigNumberish, bn } from '@mimic-fi/v1-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract, ContractTransaction } from 'ethers'

import Token from '../tokens/Token'
import TokenList from '../tokens/TokenList'
import { Account, NAry, RawVaultDeployment, toAddress, toAddresses, TxParams } from '../types'
import VaultDeployer from './VaultDeployer'

export default class Vault {
  instance: Contract
  maxSlippage: BigNumberish
  protocolFee: BigNumberish
  priceOracle: Contract
  swapConnector: Contract
  tokens: Contract[]
  strategies: Contract[]
  admin: SignerWithAddress

  static async create(params: RawVaultDeployment = {}): Promise<Vault> {
    return VaultDeployer.deploy(params)
  }

  constructor(
    instance: Contract,
    maxSlippage: BigNumberish,
    protocolFee: BigNumberish,
    priceOracle: Contract,
    swapConnector: Contract,
    tokens: Contract[],
    strategies: Contract[],
    admin: SignerWithAddress
  ) {
    this.instance = instance
    this.maxSlippage = maxSlippage
    this.protocolFee = protocolFee
    this.priceOracle = priceOracle
    this.swapConnector = swapConnector
    this.tokens = tokens
    this.strategies = strategies
    this.admin = admin
  }

  get address(): string {
    return this.instance.address
  }

  getSelector(method: string): string {
    const sighash = this.instance.interface.getSighash(method)
    return `0x${sighash.replace('0x', '').padEnd(64, '0')}`
  }

  async getMaxSlippage(): Promise<BigNumber> {
    return this.instance.maxSlippage()
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

  async getStrategyShares(strategy: Account): Promise<BigNumber> {
    return this.instance.getStrategyShares(toAddress(strategy))
  }

  async getAccountBalance(account: Account, token: Account): Promise<BigNumber> {
    return this.instance.getAccountBalance(toAddress(account), toAddress(token))
  }

  async getAccountInvestment(
    account: Account,
    strategy: Account
  ): Promise<{ shares: BigNumber; investedValue: BigNumber }> {
    return this.instance.getAccountInvestment(toAddress(account), toAddress(strategy))
  }

  async getDepositAmount(
    account: Account,
    token: Account,
    amount: BigNumberish,
    params: TxParams = {}
  ): Promise<BigNumber> {
    const call = await this.encodeDepositCall(account, token, amount)
    return this.singleQuery(call, params)
  }

  async deposit(
    account: Account,
    token: Account,
    amount: BigNumberish,
    { from }: TxParams = {}
  ): Promise<ContractTransaction> {
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.deposit(toAddress(account), toAddress(token), amount)
  }

  async getWithdrawAmount(
    account: Account,
    token: Account,
    amount: BigNumberish,
    recipient: Account,
    params: TxParams = {}
  ): Promise<BigNumber> {
    const call = await this.encodeWithdrawCall(account, token, amount, recipient)
    return this.singleQuery(call, params)
  }

  async withdraw(
    account: Account,
    token: Account,
    amount: BigNumberish,
    recipient: Account,
    { from }: TxParams = {}
  ): Promise<ContractTransaction> {
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.withdraw(toAddress(account), toAddress(token), amount, toAddress(recipient))
  }

  async getSwapAmount(
    account: Account,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: BigNumberish,
    slippage: BigNumberish,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<BigNumber> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const call = await this.encodeSwapCall(account, tokenIn, tokenOut, amountIn, slippage, data)
    return this.singleQuery(call, { from })
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

  async getJoinAmount(
    account: Account,
    strategy: Account,
    amount: BigNumberish,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<BigNumber> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const call = await this.encodeJoinCall(account, strategy, amount, data)
    return this.singleQuery(call, { from })
  }

  async join(
    account: Account,
    strategy: Account,
    amount: BigNumberish,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<ContractTransaction> {
    const data = typeof dataOrParams === 'string' ? dataOrParams : '0x'
    const from = typeof dataOrParams === 'string' ? params?.from : dataOrParams?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.join(toAddress(account), toAddress(strategy), amount, data)
  }

  async getExitAmount(
    account: Account,
    strategy: Account,
    ratio: BigNumberish,
    emergencyOrDataOrParams: boolean | string | TxParams = false,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<BigNumber> {
    const emergency = typeof emergencyOrDataOrParams === 'boolean' ? emergencyOrDataOrParams : false
    const data = typeof emergencyOrDataOrParams === 'string' ? emergencyOrDataOrParams : (dataOrParams as string)
    const from =
      typeof emergencyOrDataOrParams === 'object'
        ? emergencyOrDataOrParams?.from
        : typeof dataOrParams === 'object'
        ? dataOrParams.from
        : params?.from
    const call = await this.encodeExitCall(account, strategy, ratio, emergency, data)
    return this.singleQuery(call, { from })
  }

  async exit(
    account: Account,
    strategy: Account,
    ratio: BigNumberish,
    emergencyOrDataOrParams: boolean | string | TxParams = false,
    dataOrParams: string | TxParams = '0x',
    params: TxParams = {}
  ): Promise<ContractTransaction> {
    const emergency = typeof emergencyOrDataOrParams === 'boolean' ? emergencyOrDataOrParams : false
    const data = typeof emergencyOrDataOrParams === 'string' ? emergencyOrDataOrParams : (dataOrParams as string)
    const from =
      typeof emergencyOrDataOrParams === 'object'
        ? emergencyOrDataOrParams?.from
        : typeof dataOrParams === 'object'
        ? dataOrParams.from
        : params?.from
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.exit(toAddress(account), toAddress(strategy), ratio, emergency, data)
  }

  async singleQuery(data: string, params: TxParams): Promise<BigNumber> {
    const results = await this.query([data], [false], params)
    return bn(results[0])
  }

  async query(data: string[], readsOutput: boolean[], { from }: TxParams = {}): Promise<string[]> {
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.query(data, readsOutput)
  }

  async batch(data: string[], readsOutput: boolean[], { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = from ? this.instance.connect(from) : this.instance
    return vault.batch(data, readsOutput)
  }

  async setMaxSlippage(maxSlippage: BigNumberish, { from }: TxParams = {}): Promise<ContractTransaction> {
    const vault = this.instance.connect(from || this.admin)
    return vault.setMaxSlippage(maxSlippage)
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

  async setWhitelistedTokens(
    tokens: TokenList,
    whitelisted?: NAry<boolean>,
    { from }: TxParams = {}
  ): Promise<ContractTransaction> {
    if (!whitelisted) whitelisted = Array(tokens.length).fill(true)
    const vault = this.instance.connect(from || this.admin)
    return vault.setWhitelistedTokens(tokens.addresses, whitelisted)
  }

  async setWhitelistedStrategies(
    strategies: NAry<Account>,
    whitelisted?: NAry<boolean>,
    { from }: TxParams = {}
  ): Promise<ContractTransaction> {
    if (!Array.isArray(strategies)) strategies = [strategies]
    if (!whitelisted) whitelisted = Array(strategies.length).fill(true)
    const vault = this.instance.connect(from || this.admin)
    return vault.setWhitelistedStrategies(toAddresses(strategies), whitelisted)
  }

  encodeDepositParams(token: Account, amount: BigNumberish): string {
    return defaultAbiCoder.encode(['address', 'uint256'], [toAddress(token), amount])
  }

  encodeWithdrawParams(token: Account, amount: BigNumberish, recipient: Account): string {
    return defaultAbiCoder.encode(['address', 'uint256', 'address'], [toAddress(token), amount, toAddress(recipient)])
  }

  encodeSwapParams(
    tokenIn: Account,
    tokenOut: Account,
    amountIn: BigNumberish,
    slippage: BigNumberish,
    data: string
  ): string {
    return defaultAbiCoder.encode(
      ['address', 'address', 'uint256', 'uint256', 'bytes'],
      [toAddress(tokenIn), toAddress(tokenOut), amountIn, slippage, data]
    )
  }

  encodeJoinParams(strategy: Account, amount: BigNumberish, data: string): string {
    return defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [toAddress(strategy), amount, data])
  }

  encodeExitParams(strategy: Account, ratio: BigNumberish, emergency: boolean, data: string): string {
    return defaultAbiCoder.encode(
      ['address', 'uint256', 'bool', 'bytes'],
      [toAddress(strategy), ratio, emergency, data]
    )
  }

  async encodeDepositCall(account: Account, token: Account, amount: BigNumberish): Promise<string> {
    const tx = await this.instance.populateTransaction.deposit(toAddress(account), toAddress(token), amount.toString())
    return tx?.data || '0x'
  }

  async encodeWithdrawCall(
    account: Account,
    token: Account,
    amount: BigNumberish,
    recipient: Account
  ): Promise<string> {
    const tx = await this.instance.populateTransaction.withdraw(
      toAddress(account),
      toAddress(token),
      amount,
      toAddress(recipient)
    )
    return tx?.data || '0x'
  }

  async encodeJoinCall(account: Account, strategy: Account, amount: BigNumberish, data = '0x'): Promise<string> {
    const tx = await this.instance.populateTransaction.join(toAddress(account), toAddress(strategy), amount, data)
    return tx?.data || '0x'
  }

  async encodeExitCall(
    account: Account,
    strategy: Account,
    amount: BigNumberish,
    emergency = false,
    data = '0x'
  ): Promise<string> {
    const tx = await this.instance.populateTransaction.exit(
      toAddress(account),
      toAddress(strategy),
      amount,
      emergency,
      data
    )
    return tx?.data || '0x'
  }

  async encodeSwapCall(
    account: Account,
    tokenIn: Account,
    tokenOut: Account,
    amountIn: BigNumberish,
    slippage: BigNumberish,
    data = '0x'
  ): Promise<string> {
    const tx = await this.instance.populateTransaction.swap(
      toAddress(account),
      toAddress(tokenIn),
      toAddress(tokenOut),
      amountIn,
      slippage,
      data
    )
    return tx?.data || '0x'
  }
}
