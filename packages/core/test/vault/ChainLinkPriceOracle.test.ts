import { expect } from 'chai'
import { Contract } from 'ethers'
import { fp, deploy, ZERO_ADDRESS } from '@mimic-fi/v1-helpers'

import TokenList from '../helpers/models/tokens/TokenList'

describe('ChainLinkPriceOracle', () => {
  let tokens: TokenList, feedToken1: Contract, feedToken2: Contract, oracle: Contract

  const priceOneFeed = '0x1111111111111111111111111111111111111111'

  beforeEach('create oracle', async () => {
    tokens = await TokenList.create(3)

    feedToken1 = await deploy('ChainLinkAggregatorV3', [18])
    feedToken2 = await deploy('ChainLinkAggregatorV3', [18])

    //Token 3 price is always 1
    const feeds = [feedToken1.address, feedToken2.address, priceOneFeed]

    oracle = await deploy('ChainLinkPriceOracle', [tokens.addresses, feeds])
  })

  describe('deploy', () => {
    it('valid tokens have a feed', async () => {
      expect(await oracle.hasFeed(tokens.first.address)).to.be.true
      expect(await oracle.hasFeed(tokens.second.address)).to.be.true
      expect(await oracle.hasFeed(tokens.third.address)).to.be.true

      expect(await oracle.getFeed(tokens.first.address)).to.be.equal(feedToken1.address)
      expect(await oracle.getFeed(tokens.second.address)).to.be.equal(feedToken2.address)
      expect(await oracle.getFeed(tokens.third.address)).to.be.equal(priceOneFeed)
    })

    it('invalid token has no feed', async () => {
      expect(await oracle.hasFeed(ZERO_ADDRESS)).to.be.false
    })
  })

  describe('getTokenPrice', () => {
    it('token one & base three', async () => {
      const price1 = fp(2)

      await feedToken1.setPrice(price1)

      const price = await oracle.getTokenPrice(tokens.first.address, tokens.third.address)
      expect(price).to.be.equal(price1)
    })

    it('token two & base three', async () => {
      const price2 = fp(0.5)

      await feedToken2.setPrice(price2)

      const price = await oracle.getTokenPrice(tokens.second.address, tokens.third.address)
      expect(price).to.be.equal(price2)
    })

    it('token three & base one', async () => {
      const price1 = fp(2)

      await feedToken1.setPrice(price1)

      const price = await oracle.getTokenPrice(tokens.third.address, tokens.first.address)
      expect(price).to.be.equal(fp(1).mul(fp(1)).div(price1))
    })

    it('token one & base two', async () => {
      const price2 = fp(0.5)

      await feedToken2.setPrice(price2)

      const price = await oracle.getTokenPrice(tokens.third.address, tokens.second.address)
      expect(price).to.be.equal(fp(1).mul(fp(1)).div(price2))
    })

    it('token one & base second', async () => {
      const price1 = fp(2)
      const price2 = fp(0.5)

      await feedToken1.setPrice(price1)
      await feedToken2.setPrice(price2)

      const price = await oracle.getTokenPrice(tokens.first.address, tokens.second.address)
      expect(price).to.be.equal(price1.mul(fp(1)).div(price2))
    })

    it('token one & base second', async () => {
      const price1 = fp(2)
      const price2 = fp(0.5)

      await feedToken1.setPrice(price1)
      await feedToken2.setPrice(price2)

      const price = await oracle.getTokenPrice(tokens.second.address, tokens.first.address)
      expect(price).to.be.equal(price2.mul(fp(1)).div(price1))
    })

    it('fails when invalid token', async () => {
      await expect(oracle.getTokenPrice(ZERO_ADDRESS, tokens.first.address)).to.be.revertedWith('TOKEN_WITH_NO_FEED')
    })

    it('fails when invalid base', async () => {
      await expect(oracle.getTokenPrice(tokens.first.address, ZERO_ADDRESS)).to.be.revertedWith('BASE_WITH_NO_FEED')
    })
  })
})
