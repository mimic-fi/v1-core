import { BigNumber } from 'ethers'
import { BigNumberish } from '@mimic-fi/v1-helpers'

import Token from './Token'
import TokensDeployer from './TokensDeployer'

import { Account, NAry, TxParams } from '../types'

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

  async balanceOf(account: Account): Promise<BigNumber[]> {
    return Promise.all(this.tokens.map((token) => token.balanceOf(account)))
  }

  async allowance(account: Account, spender: Account): Promise<BigNumber[]> {
    return Promise.all(this.tokens.map((token) => token.allowance(account, spender)))
  }

  async mint(to: NAry<Account>, amount: NAry<BigNumberish>, { from }: TxParams = {}): Promise<void> {
    if (!Array.isArray(to)) to = [to]
    const amounts = Array.isArray(amount) ? amount : Array(to.length).fill(amount)
    await Promise.all(to.flatMap((to, i) => this.tokens.map((token) => token.mint(to, amounts[i], { from }))))
  }

  async approve(to: NAry<Account>, amount: NAry<BigNumberish>, { from }: TxParams = {}): Promise<void> {
    if (!Array.isArray(to)) to = [to]
    const amounts = !Array.isArray(amount) ? Array(to.length).fill(amount) : amount
    await Promise.all(to.flatMap((to, i) => this.tokens.map((token) => token.approve(to, amounts[i], { from }))))
  }

  each(fn: (value: Token, i: number, array: Token[]) => void, thisArg?: unknown): void {
    this.tokens.forEach(fn, thisArg)
  }

  async asyncEach(fn: (value: Token, i: number, array: Token[]) => Promise<void>, thisArg?: unknown): Promise<void> {
    await this.asyncMap(fn, thisArg)
  }

  map<T>(fn: (value: Token, i: number, array: Token[]) => T, thisArg?: unknown): T[] {
    return this.tokens.map(fn, thisArg)
  }

  async asyncMap<T>(fn: (value: Token, i: number, array: Token[]) => Promise<T>, thisArg?: unknown): Promise<T[]> {
    const promises = this.tokens.map(fn, thisArg)
    return Promise.all(promises)
  }
}
