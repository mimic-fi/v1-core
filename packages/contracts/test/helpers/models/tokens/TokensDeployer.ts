import { deploy, getSigner } from '@mimic-fi/v1-helpers'

import { NAry, TxParams } from '../types'

import Token from './Token'
import TokenList from './TokenList'

class TokensDeployer {
  async deployList(params: number | NAry<string>, txParams: TxParams = {}): Promise<TokenList> {
    if (typeof params === 'number')
      params = Array(params)
        .fill('TK')
        .map((t, i) => `${t}${i}`)
    if (!Array.isArray(params)) params = [params]
    const tokens = await Promise.all(params.map((symbol) => this.deployToken(symbol, txParams)))
    return new TokenList(tokens)
  }

  async deployToken(symbol: string, { from }: TxParams = {}): Promise<Token> {
    const sender = from || (await getSigner())
    const instance = await deploy('TokenMock', [symbol], sender)
    return new Token(symbol, instance)
  }
}

export default new TokensDeployer()
