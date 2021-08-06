import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { fp, deploy, getSigners, ZERO_ADDRESS, MAX_UINT256 } from '@mimic-fi/v1-helpers'

import TokenList from '../helpers/models/tokens/TokenList'

describe('UniswapConnector', () => {
  let user: SignerWithAddress
  let tokens: TokenList, factory: Contract, uniswap: Contract, connector: Contract

  const firstTokenInitialAmount = fp(1000)
  const secondTokenInitialAmount = fp(1000).mul(150)

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [user] = await getSigners()
  })

  beforeEach('create connector', async () => {
    factory = await deploy('@uniswap/v2-core/build/UniswapV2Factory', [user.address])
    uniswap = await deploy('@uniswap/v2-periphery/build/UniswapV2Router02', [factory.address, ZERO_ADDRESS])
    connector = await deploy('UniswapConnector', [uniswap.address])
  })

  beforeEach('create pool', async () => {
    tokens = await TokenList.create(2)
    await tokens.first.mint(user, firstTokenInitialAmount)
    await tokens.first.approve(uniswap, firstTokenInitialAmount, { from: user })
    await tokens.second.mint(user, secondTokenInitialAmount)
    await tokens.second.approve(uniswap, secondTokenInitialAmount, { from: user })
    await uniswap.connect(user).addLiquidity(tokens.first.address, tokens.second.address, firstTokenInitialAmount, secondTokenInitialAmount, 0, 0, user.address, MAX_UINT256)
  })

  describe('getAmountOut', () => {
    it('tells the expected first token rate', async () => {
      const amountOut = await connector.getAmountOut(tokens.first.address, tokens.second.address, 10)
      expect(amountOut).to.be.equal(1495)
    })

    it('tells the expected second token rate', async () => {
      const amountOut = await connector.getAmountOut(tokens.second.address, tokens.first.address, 3000)
      expect(amountOut).to.be.equal(19)
    })
  })

  describe('swap', () => {
    const amount = fp(10)

    it('swaps correctly', async () => {
      await tokens.first.mint(user, amount)
      await tokens.first.transfer(connector, amount, { from: user })

      const previousBalance = await tokens.second.balanceOf(user)
      await connector.connect(user).swap(tokens.first.address, tokens.second.address, amount, 0, MAX_UINT256, '0x')

      const expectedAmountOut = fp(1500).mul(997).div(1000)
      const currentBalance = await tokens.second.balanceOf(user)
      expect(currentBalance).to.be.at.least(previousBalance.add(expectedAmountOut).sub(fp(15)))
      expect(currentBalance).to.be.at.most(previousBalance.add(expectedAmountOut).add(fp(15)))
    })
  })
})
