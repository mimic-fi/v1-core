import { BigNumberish } from '@octopus-fi/v1-helpers'
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

  async setWhitelistedStrategies(strategies: NAry<Account>, whitelisted?: NAry<boolean>, { from }: TxParams = {}): Promise<ContractTransaction> {
    if (!Array.isArray(strategies)) strategies = [strategies]
    if (!whitelisted) whitelisted = Array(strategies.length).fill(true)
    const agreement = this.instance.connect(from || this.admin)
    return agreement.setWhitelistedStrategies(toAddresses(strategies), whitelisted)
  }

  async deposit(account: Account, tokens: NAry<Account>, amounts: NAry<BigNumberish>, { from }: TxParams = {}): Promise<void> {
    if (!Array.isArray(tokens)) tokens = [tokens]
    amounts = !Array.isArray(amounts) ? Array(tokens.length).fill(amounts) : amounts
    const vault = from ? this.instance.connect(from) : this.instance
    await vault.deposit(toAddress(account), toAddresses(tokens), amounts)
  }

  async withdraw(account: Account, tokens: NAry<Account>, amounts: NAry<BigNumberish>, recipient: Account, { from }: TxParams = {}): Promise<void> {
    if (!Array.isArray(tokens)) tokens = [tokens]
    amounts = !Array.isArray(amounts) ? Array(tokens.length).fill(amounts) : amounts
    const vault = from ? this.instance.connect(from) : this.instance
    await vault.withdraw(toAddress(account), toAddresses(tokens), amounts, toAddress(recipient))
  }
}
