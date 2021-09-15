import { BigNumberish } from '@mimic-fi/v1-helpers'

import { Account, NAry, TxParams } from '../types'
import Token from './Token'
import TokensDeployer from './TokensDeployer'

export default class TokenList {
  tokens: Token[]

  static async create(params: number | NAry<string>): Promise<TokenList> {
    return TokensDeployer.deployList(params)
  }

  constructor(tokens: Token[] = []) {
    this.tokens = tokens
  }

  get length(): number {
    return this.tokens.length
  }

  get addresses(): string[] {
    return this.tokens.map((token) => token.address)
  }

  get first(): Token {
    return this.tokens[0]
  }

  get second(): Token {
    return this.tokens[1]
  }

  async approve(to: NAry<Account>, amount: NAry<BigNumberish>, { from }: TxParams = {}): Promise<void> {
    if (!Array.isArray(to)) to = [to]
    const amounts = !Array.isArray(amount) ? Array(to.length).fill(amount) : amount
    await Promise.all(to.flatMap((to, i) => this.tokens.map((token) => token.approve(to, amounts[i], { from }))))
  }
}
