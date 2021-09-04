import { MAX_UINT256, BigNumberish } from '@mimic-fi/v1-helpers'
import { BigNumber, Contract, ContractTransaction } from 'ethers'

import TokensDeployer from './TokensDeployer'
import { Account, toAddress, TxParams } from '../types'

export default class Token {
  symbol: string
  instance: Contract

  static async create(symbol: string, decimals?: number, txParams: TxParams = {}): Promise<Token> {
    return TokensDeployer.deployToken(symbol, decimals, txParams)
  }

  constructor(symbol: string, instance: Contract) {
    this.symbol = symbol
    this.instance = instance
  }

  get address(): string {
    return this.instance.address
  }

  async decimals(): Promise<number> {
    return this.instance.decimals()
  }

  async balanceOf(account: Account): Promise<BigNumber> {
    return this.instance.balanceOf(toAddress(account))
  }

  async allowance(account: Account, spender: Account): Promise<BigNumber> {
    return this.instance.allowance(toAddress(account), toAddress(spender))
  }

  async mint(to: Account, amount?: BigNumberish, { from }: TxParams = {}): Promise<void> {
    const token = from ? this.instance.connect(from) : this.instance
    await token.mint(toAddress(to), amount ?? MAX_UINT256)
  }

  async transfer(to: Account, amount: BigNumberish, { from }: TxParams = {}): Promise<ContractTransaction> {
    const token = from ? this.instance.connect(from) : this.instance
    return token.transfer(toAddress(to), amount)
  }

  async approve(to: Account, amount?: BigNumberish, { from }: TxParams = {}): Promise<ContractTransaction> {
    const token = from ? this.instance.connect(from) : this.instance
    return token.approve(toAddress(to), amount ?? MAX_UINT256)
  }

  async burn(amount: BigNumberish, { from }: TxParams = {}): Promise<ContractTransaction> {
    const token = from ? this.instance.connect(from) : this.instance
    return token.burn(amount)
  }
}
