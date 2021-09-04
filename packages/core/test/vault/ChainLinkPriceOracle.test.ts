import { expect } from 'chai'
import { Contract } from 'ethers'
import { fp, deploy, decimal, bn, ZERO_ADDRESS } from '@mimic-fi/v1-helpers'

import Token from '../helpers/models/tokens/Token'

describe('ChainLinkPriceOracle', () => {
  let tokenA: Token, tokenB: Token, tokenC: Token, tokenD: Token, feedTokenA: Contract, feedTokenC: Contract, feedTokenD: Contract, oracle: Contract

  const priceOneFeed = '0x1111111111111111111111111111111111111111'

  beforeEach('create oracle', async () => {
    tokenA = await Token.create('TokenA', 18)
    tokenB = await Token.create('TokenA', 18)
    tokenC = await Token.create('TokenA', 6)
    tokenD = await Token.create('TokenA', 8)

    feedTokenA = await deploy('ChainLinkAggregatorV3', [18])
    feedTokenC = await deploy('ChainLinkAggregatorV3', [18])
    feedTokenD = await deploy('ChainLinkAggregatorV3', [18])

    const tokens = [tokenA.address, tokenB.address, tokenC.address, tokenD.address]
    //Token B price is always 1
    const feeds = [feedTokenA.address, priceOneFeed, feedTokenC.address, feedTokenD.address]

    oracle = await deploy('ChainLinkPriceOracle', [tokens, feeds])
  })

  describe('deploy', () => {
    it('valid tokens have a feed', async () => {
      expect(await oracle.hasPriceFeed(tokenA.address)).to.be.true
      expect(await oracle.hasPriceFeed(tokenB.address)).to.be.true
      expect(await oracle.hasPriceFeed(tokenC.address)).to.be.true
      expect(await oracle.hasPriceFeed(tokenD.address)).to.be.true

      const feedA = await oracle.getPriceFeed(tokenA.address)
      expect(feedA.aggregator).to.be.equal(feedTokenA.address)
      expect(feedA.tokenDecimals).to.be.equal(await tokenA.decimals())

      const feedB = await oracle.getPriceFeed(tokenB.address)
      expect(feedB.aggregator).to.be.equal(priceOneFeed)
      expect(feedB.tokenDecimals).to.be.equal(await tokenB.decimals())

      const feedC = await oracle.getPriceFeed(tokenC.address)
      expect(feedC.aggregator).to.be.equal(feedTokenC.address)
      expect(feedC.tokenDecimals).to.be.equal(await tokenC.decimals())

      const feedD = await oracle.getPriceFeed(tokenD.address)
      expect(feedD.aggregator).to.be.equal(feedTokenD.address)
      expect(feedD.tokenDecimals).to.be.equal(await tokenD.decimals())
    })

    it('invalid token has no feed', async () => {
      expect(await oracle.hasPriceFeed(ZERO_ADDRESS)).to.be.false
    })
  })

  describe('getTokenPrice', () => {
    const priceA = fp(2)

    beforeEach('set prices', async () => {
      await feedTokenA.setPrice(priceA)
    })

    it('token A & base B', async () => {
      const price = await oracle.getTokenPrice(tokenA.address, tokenB.address)
      const calcPrice = fp(1).mul(fp(1)).div(priceA)

      expect(price).to.be.equal(calcPrice)
    })

    it('token B & base A', async () => {
      const price = await oracle.getTokenPrice(tokenB.address, tokenA.address)

      expect(price).to.be.equal(priceA)
    })

    it('fails when invalid token', async () => {
      await expect(oracle.getTokenPrice(ZERO_ADDRESS, tokenA.address)).to.be.revertedWith('TOKEN_WITH_NO_FEED')
    })

    it('fails when invalid base', async () => {
      await expect(oracle.getTokenPrice(tokenA.address, ZERO_ADDRESS)).to.be.revertedWith('BASE_WITH_NO_FEED')
    })
  })

  describe('decimals', () => {
    const priceA = fp(2)
    const priceC = fp(3)
    const priceD = fp(5)

    beforeEach('set prices', async () => {
      await feedTokenA.setPrice(priceA)
      await feedTokenC.setPrice(priceC)
      await feedTokenD.setPrice(priceD)
    })

    it('token A & base C', async () => {
      const price = await oracle.getTokenPrice(tokenA.address, tokenC.address)

      const oneInBaseDecimals = bn(decimal(10).pow(decimal(await tokenC.decimals())))
      const unScaleBasePrice = price.mul(oneInBaseDecimals).div(fp(1))

      const calcPrice = fp(1).mul(priceC).div(priceA)

      expect(unScaleBasePrice).to.be.equal(calcPrice)
    })

    it('token C & base A', async () => {
      const price = await oracle.getTokenPrice(tokenC.address, tokenA.address)

      const calcPrice = fp(1).mul(priceA).div(priceC)
      const oneInTokenDecimals = bn(decimal(10).pow(decimal(await tokenC.decimals())))
      const scaledTokenCalcPrice = calcPrice.mul(oneInTokenDecimals).div(fp(1))

      expect(scaledTokenCalcPrice).to.be.equal(price)
    })

    it('token C & base D', async () => {
      const price = await oracle.getTokenPrice(tokenC.address, tokenD.address)

      const oneInBaseDecimals = bn(decimal(10).pow(decimal(await tokenD.decimals())))
      const unScaleBasePrice = price.mul(oneInBaseDecimals).div(fp(1))

      const calcPrice = fp(1).mul(priceD).div(priceC)
      const oneInTokenDecimals = bn(decimal(10).pow(decimal(await tokenC.decimals())))
      const scaledTokenCalcPrice = calcPrice.mul(oneInTokenDecimals).div(fp(1))

      expect(unScaleBasePrice).to.be.equal(scaledTokenCalcPrice)
    })

    it('token D & base C', async () => {
      const price = await oracle.getTokenPrice(tokenD.address, tokenC.address)

      const oneInBaseDecimals = bn(decimal(10).pow(decimal(await tokenC.decimals())))
      const unScaleBasePrice = price.mul(oneInBaseDecimals).div(fp(1))

      const calcPrice = fp(1).mul(priceC).div(priceD)
      const oneInTokenDecimals = bn(decimal(10).pow(decimal(await tokenD.decimals())))
      const scaledTokenCalcPrice = calcPrice.mul(oneInTokenDecimals).div(fp(1))

      expect(unScaleBasePrice).to.be.equal(scaledTokenCalcPrice)
    })
  })
})
