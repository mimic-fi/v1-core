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
    let strategies: string[], feeCollector: string, withdrawer1: string, withdrawer2: string, manager1: string, manager2: string

    const name = 'Test Agreement'
    const depositFee = fp(0.00005)
    const performanceFee = fp(0.00001)
    const allowedStrategies = 2

    before('set up withdrawers and managers', async () => {
      // eslint-disable-next-line prettier/prettier
      [feeCollector, withdrawer1, withdrawer2, manager1, manager2] = toAddresses(await getSigners())
    })

    before('deploy strategies', async () => {
      const tokens = await TokenList.create(2)
      const strategy1 = await deploy('StrategyMock', [tokens.first.address])
      const strategy2 = await deploy('StrategyMock', [tokens.second.address])
      strategies = [strategy1.address, strategy2.address]
    })

    it('creates an agreement as expected', async () => {
      const managers = [manager1, manager2]
      const withdrawers = [withdrawer1, withdrawer2]

      const tx = await factory.create(name, depositFee, performanceFee, feeCollector, managers, withdrawers, allowedStrategies, strategies)

      const { args } = await assertEvent(tx, 'AgreementCreated', { name })
      const agreement = await instanceAt('Agreement', args.agreement)

      expect(await agreement.name()).to.equal(name)
      expect(await agreement.vault()).to.equal(await factory.vault())
      expect(await agreement.depositFee()).to.equal(depositFee)
      expect(await agreement.performanceFee()).to.equal(performanceFee)
      expect(await agreement.feeCollector()).to.equal(feeCollector)
      expect(await agreement.isManager(manager1)).to.be.true
      expect(await agreement.isManager(manager2)).to.be.true
      expect(await agreement.isWithdrawer(withdrawer1)).to.be.true
      expect(await agreement.isWithdrawer(withdrawer2)).to.be.true
      expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
      expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true

      expect(await factory.isAgreement(agreement.address)).to.be.true
    })

    it('costs almost 2M', async () => {
      const managers = [manager1, manager2]
      const withdrawers = [withdrawer1, withdrawer2]

      const tx = await factory.create(name, depositFee, performanceFee, feeCollector, managers, withdrawers, allowedStrategies, strategies)
      const { gasUsed } = await tx.wait()
      expect(gasUsed).to.be.at.least(2.0e6)
      expect(gasUsed).to.be.at.most(2.1e6)
    })
  })
})
