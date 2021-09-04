import { deploy, getSigner } from '@mimic-fi/v1-helpers'

import Token from './Token'
import TokenList from './TokenList'
import { NAry, TxParams } from '../types'

class TokensDeployer {
  async deployList(params: number | NAry<string>, txParams: TxParams = {}): Promise<TokenList> {
    if (typeof params === 'number')
      params = Array(params)
        .fill('TK')
        .map((t, i) => `${t}${i}`)
    if (!Array.isArray(params)) params = [params]
    const tokens = await Promise.all(params.map((symbol) => this.deployToken(symbol, 18, txParams)))
    return new TokenList(tokens)
  }

  async deployToken(symbol: string, decimals?: number, { from }: TxParams = {}): Promise<Token> {
    const sender = from || (await getSigner())
    const instance = await deploy('TokenMock', [symbol, decimals ?? 18], sender)
    return new Token(symbol, instance)
  }
}

export default new TokensDeployer()
