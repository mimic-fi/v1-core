import { expect } from 'chai'
import { Contract } from 'ethers'
import { fp, deploy, getSigners, assertEvent, instanceAt } from '@mimic-fi/v1-helpers'

import Vault from '../helpers/models/vault/Vault'
import TokenList from '../helpers/models/tokens/TokenList'
import { toAddresses } from '../helpers/models/types'

describe('AgreementFactory', () => {
  let factory: Contract

  beforeEach('deploy tokens', async () => {
    const vault = await Vault.create()
    factory = await deploy('AgreementFactory', [vault.address])
  })

  describe('create', () => {
    it('creates an agreement as expected', async () => {
      const name = 'Test Agreement'
      const depositFee = fp(0.00005)
      const performanceFee = fp(0.00001)
      const maxSwapSlippage = fp(0.1)
      const [feeCollector, withdrawer1, withdrawer2, manager1, manager2] = toAddresses(await getSigners())
      const managers = [manager1, manager2]
      const withdrawers = [withdrawer1, withdrawer2]
      const allowedTokens = 2
      const tokens = await TokenList.create(2)
      const allowedStrategies = 2
      const strategy1 = await deploy('StrategyMock', [tokens.first.address])
      const strategy2 = await deploy('StrategyMock', [tokens.second.address])
      const strategies = [strategy1.address, strategy2.address]

      const tx = await factory.create(name, feeCollector, depositFee, performanceFee, maxSwapSlippage, managers, withdrawers, tokens.addresses, allowedTokens, strategies, allowedStrategies)

      const { args } = await assertEvent(tx, 'AgreementCreated', { name })
      const agreement = await instanceAt('Agreement', args.agreement)

      expect(await agreement.vault()).to.equal(await factory.vault())
      expect(await agreement.depositFee()).to.equal(depositFee)
      expect(await agreement.performanceFee()).to.equal(performanceFee)
      expect(await agreement.feeCollector()).to.equal(feeCollector)
      expect(await agreement.maxSwapSlippage()).to.equal(maxSwapSlippage)
      expect(await agreement.isManager(manager1)).to.be.true
      expect(await agreement.isManager(manager2)).to.be.true
      expect(await agreement.isWithdrawer(withdrawer1)).to.be.true
      expect(await agreement.isWithdrawer(withdrawer2)).to.be.true
      expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
      expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true

      expect(await factory.isAgreement(agreement.address)).to.be.true
    })
  })
})
