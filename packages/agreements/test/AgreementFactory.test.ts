import { assertEvent, deploy, fp, getSigners, instanceAt } from '@mimic-fi/v1-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { toAddresses } from './helpers/types'

describe('AgreementFactory', () => {
  let factory: Contract

  beforeEach('deploy tokens', async () => {
    const weth = await deploy('WethMock')
    const vault = await deploy('VaultMock')
    factory = await deploy('AgreementFactory', [weth.address, vault.address])
  })

  describe('create', () => {
    it('creates an agreement as expected', async () => {
      const name = 'Test Agreement'
      const depositFee = fp(0.005)
      const withdrawFee = fp(0.003)
      const performanceFee = fp(0.001)
      const maxSwapSlippage = fp(0.1)
      const [feeCollector, withdrawer1, withdrawer2, manager1, manager2] = toAddresses(await getSigners())
      const managers = [manager1, manager2]
      const withdrawers = [withdrawer1, withdrawer2]
      const allowedTokens = 2
      const token1 = await deploy('TokenMock')
      const token2 = await deploy('TokenMock')
      const allowedStrategies = 2
      const strategy1 = await deploy('StrategyMock')
      const strategy2 = await deploy('StrategyMock')

      const tx = await factory.create(
        name,
        feeCollector,
        depositFee,
        withdrawFee,
        performanceFee,
        maxSwapSlippage,
        managers,
        withdrawers,
        [token1.address, token2.address],
        allowedTokens,
        [strategy1.address, strategy2.address],
        allowedStrategies
      )

      const { args } = await assertEvent(tx, 'AgreementCreated', { name })
      const agreement = await instanceAt('Agreement', args.agreement)

      expect(await agreement.vault()).to.equal(await factory.vault())
      expect(await agreement.depositFee()).to.equal(depositFee)
      expect(await agreement.withdrawFee()).to.equal(withdrawFee)
      expect(await agreement.performanceFee()).to.equal(performanceFee)
      expect(await agreement.feeCollector()).to.equal(feeCollector)
      expect(await agreement.maxSwapSlippage()).to.equal(maxSwapSlippage)
      expect(await agreement.isManager(manager1)).to.be.true
      expect(await agreement.isManager(manager2)).to.be.true
      expect(await agreement.isWithdrawer(withdrawer1)).to.be.true
      expect(await agreement.isWithdrawer(withdrawer2)).to.be.true
      expect(await agreement.isTokenAllowed(token1.address)).to.be.true
      expect(await agreement.isTokenAllowed(token2.address)).to.be.true
      expect(await agreement.isStrategyAllowed(strategy1.address)).to.be.true
      expect(await agreement.isStrategyAllowed(strategy2.address)).to.be.true

      expect(await factory.isAgreement(agreement.address)).to.be.true
    })
  })
})
