import {expect} from 'chai'
import {Contract} from 'ethers'
import {deploy, fp, getSigner, getSigners, MAX_UINT256, ZERO_ADDRESS} from '@mimic-fi/v1-helpers'

import Vault from '../helpers/models/vault/Vault'
import TokenList from '../helpers/models/tokens/TokenList'
import Agreement from '../helpers/models/agreement/Agreement'
import {Account, toAddress, toAddresses} from '../helpers/models/types'

describe('Agreement', () => {
  let tokens: TokenList

  beforeEach('deploy tokens', async () => {
    tokens = await TokenList.create(4)
  })

  describe('withdrawers', () => {
    context('when using non-zero address', async () => {
      it('marks them as allowed senders', async () => {
        const withdrawers = await getSigners(2)
        const agreement = await Agreement.create({ withdrawers })

        expect(await agreement.areWithdrawers(withdrawers)).to.be.true
        expect(await agreement.areAllowedSenders(withdrawers)).to.be.true
      })
    })

    context('when using a zero address', async () => {
      it('reverts', async () => {
        const withdrawers = [ZERO_ADDRESS]

        await expect(Agreement.create({ withdrawers })).to.be.revertedWith('WITHDRAWER_ZERO_ADDRESS')
      })
    })

    context('when using an empty array', async () => {
      it('reverts', async () => {
        const withdrawers: string[] = []

        await expect(Agreement.create({ withdrawers })).to.be.revertedWith('MISSING_WITHDRAWERS')
      })
    })
  })

  describe('managers', () => {
    context('when using non-zero address', async () => {
      it('marks them as allowed senders', async () => {
        const managers = await getSigners(2)
        const agreement = await Agreement.create({ managers })

        expect(await agreement.areManagers(managers)).to.be.true
        expect(await agreement.areAllowedSenders(managers)).to.be.true
      })
    })

    context('when using a zero address', async () => {
      it('reverts', async () => {
        const managers = [ZERO_ADDRESS]

        await expect(Agreement.create({ managers })).to.be.revertedWith('MANAGER_ZERO_ADDRESS')
      })
    })

    context('when using an empty array', async () => {
      it('reverts', async () => {
        const managers: string[] = []

        await expect(Agreement.create({ managers })).to.be.revertedWith('MISSING_MANAGERS')
      })
    })
  })

  describe('deposit fee', () => {
    context('when using a zero fee', async () => {
      const depositFee = 0

      it('accepts the fee', async () => {
        const agreement = await Agreement.create({ depositFee })

        const { fee } = await agreement.getDepositFee()
        expect(fee).to.be.equal(depositFee)
      })
    })

    context('when using a fee between zero and the maximum allowed', async () => {
      const depositFee = fp(0.5)

      it('accepts the fee', async () => {
        const agreement = await Agreement.create({ depositFee })

        const { fee } = await agreement.getDepositFee()
        expect(fee).to.be.equal(depositFee)
      })
    })

    context('when using a fee above the maximum allowed', async () => {
      const depositFee = fp(1).add(1)

      it('reverts', async () => {
        await expect(Agreement.create({ depositFee })).to.be.revertedWith('DEPOSIT_FEE_TOO_HIGH')
      })
    })
  })

  describe('performance fee', () => {
    context('when using a zero fee', async () => {
      const performanceFee = 0

      it('accepts the fee', async () => {
        const agreement = await Agreement.create({ performanceFee })

        const { fee } = await agreement.getPerformanceFee()
        expect(fee).to.be.equal(performanceFee)
      })
    })

    context('when using a fee between zero and the maximum allowed', async () => {
      const performanceFee = fp(0.5)

      it('accepts the fee', async () => {
        const agreement = await Agreement.create({ performanceFee })

        const { fee } = await agreement.getPerformanceFee()
        expect(fee).to.be.equal(performanceFee)
      })
    })

    context('when using a fee above the maximum allowed', async () => {
      const performanceFee = fp(1).add(1)

      it('reverts', async () => {
        await expect(Agreement.create({ performanceFee })).to.be.revertedWith('PERFORMANCE_FEE_TOO_HIGH')
      })
    })
  })

  describe('fee collector', () => {
    context('when using a zero address', async () => {
      const feeCollector = ZERO_ADDRESS

      it('reverts', async () => {
        await expect(Agreement.create({ feeCollector })).to.be.revertedWith('FEE_COLLECTOR_ZERO_ADDRESS')
      })
    })

    context('when using a non-zero address', async () => {
      it('accepts the address', async () => {
        const feeCollector = await getSigner()

        const agreement = await Agreement.create({ feeCollector })

        expect(await agreement.getFeeCollector()).to.be.equal(feeCollector.address)
      })
    })
  })

  describe('max swap slippage', () => {
    context('when 0%', async () => {
      const maxSwapSlippage = 0

      it('accepts the slippage', async () => {
        const agreement = await Agreement.create({ maxSwapSlippage })

        expect(await agreement.getMaxSwapSlippage()).to.be.equal(maxSwapSlippage)
      })
    })

    context('when between 0% and 100%', async () => {
      const maxSwapSlippage = fp(0.5)

      it('accepts the slippage', async () => {
        const agreement = await Agreement.create({ maxSwapSlippage })

        expect(await agreement.getMaxSwapSlippage()).to.be.equal(maxSwapSlippage)
      })
    })

    context('when above 100%', async () => {
      const maxSwapSlippage = fp(1).add(1)

      it('reverts', async () => {
        await expect(Agreement.create({ maxSwapSlippage })).to.be.revertedWith('MAX_SWAP_SLIPPAGE_TOO_HIGH')
      })
    })
  })

  describe('strategies', () => {
    let vault: Vault, strategies: Contract[], whitelistedStrategy: Contract

    beforeEach('deploy strategies', async () => {
      strategies = []
      for (let i = 0; i < 3; i++) strategies.push(await deploy('StrategyMock', [tokens.first.address]))

      whitelistedStrategy = await deploy('StrategyMock', [tokens.first.address])
      vault = await Vault.create({ strategies: [whitelistedStrategy] })
    })

    context('when allowing any', () => {
      const allowedStrategies = 'any'

      context('without a custom set', () => {
        it('allows any strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[2])).to.be.true
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })

      context('with a custom set', () => {
        it('allows any strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[2])).to.be.true
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })
    })

    context('when allowing none', () => {
      const allowedStrategies = 'none'

      context('without a custom set', () => {
        it('does not any strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[0])).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[1])).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[2])).to.be.false
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.false
        })
      })

      context('with a custom set', () => {
        it('allows only the custom strategies', async () => {
          const agreement = await Agreement.create({ vault, strategies, allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[2])).to.be.true
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.false
        })
      })
    })

    context('when allowing whitelisted', () => {
      const allowedStrategies = 'whitelisted'

      context('without a custom set', () => {
        it('allows any whitelisted strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[0])).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[1])).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[2])).to.be.false
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })

      context('with a custom set', () => {
        it('allows any whitelisted and custom strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies, allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true
          expect(await agreement.isStrategyAllowed(strategies[2])).to.be.true
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })
    })
  })

  describe('tokens', () => {
    let vault: Vault, whitelistedToken: Contract, customTokens: Contract[]

    beforeEach('deploy tokens', async () => {
      customTokens = []

      for (let i = 0; i < 3; i++) {
        customTokens.push(tokens.tokens[i].instance)
      }

      whitelistedToken = tokens.tokens[3].instance
      vault = await Vault.create({ tokens: [whitelistedToken] })
    })

    context('when allowing any', () => {
      const allowedTokens = 'any'

      context('without a custom set of tokens', () => {
        it('allows any token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[0])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[1])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[2])).to.be.true
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })

      context('with a custom set of tokens', () => {
        it('allows any token', async () => {
          const agreement = await Agreement.create({ vault, tokens: customTokens, allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[0])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[1])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[2])).to.be.true
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })
    })

    context('when allowing none', () => {
      const allowedTokens = 'none'

      context('without a custom set of tokens', () => {
        it('does not allow any token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[0])).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[1])).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[2])).to.be.false
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.false
        })
      })

      context('with a custom set of tokens', () => {
        it('allows only the custom tokens', async () => {
          const agreement = await Agreement.create({ vault, tokens: customTokens, allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[0])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[1])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[2])).to.be.true
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.false
        })
      })
    })

    context('when allowing whitelisted', () => {
      const allowedTokens = 'whitelisted'

      context('without a custom set of tokens', () => {
        it('allows any whitelisted token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[0])).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[1])).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[2])).to.be.false
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })

      context('with a custom set of tokens', () => {
        it('allows any whitelisted and custom token', async () => {
          const agreement = await Agreement.create({ vault, tokens: customTokens, allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customTokens[0])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[1])).to.be.true
          expect(await agreement.isTokenAllowed(customTokens[2])).to.be.true
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })
    })
  })

  describe('can perform', () => {
    let agreement: Agreement, who: Account, where: string, customStrategy: Contract, customToken: Contract

    const maxSwapSlippage = fp(0.2)

    beforeEach('deploy agreement', async () => {
      customToken = tokens.first.instance
      customStrategy = await deploy('StrategyMock', [customToken.address])
      agreement = await Agreement.create({ allowedStrategies: 'none', strategies: [customStrategy], allowedTokens: 'none', tokens: [customToken], maxSwapSlippage })
    })

    const itDoesNotAcceptAnyAction = () => {
      it('does not accept any actions', async () => {
        expect(await agreement.canPerform({ who, where })).to.be.false
        expect(await agreement.canPerform({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canDeposit({ who, where })).to.be.false
        expect(await agreement.canDeposit({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canWithdraw({ who, where })).to.be.false
        expect(await agreement.canWithdraw({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canSwap({ who, where })).to.be.false
        expect(await agreement.canSwap({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canJoin({ who, where })).to.be.false
        expect(await agreement.canJoin({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canExit({ who, where })).to.be.false
        expect(await agreement.canExit({ who, where, how: [ZERO_ADDRESS] })).to.be.false
      })
    }

    const itAcceptsAllowedActions = () => {
      it('accepts any deposit', async () => {
        expect(await agreement.canDeposit({ who, where })).to.be.true
        expect(await agreement.canDeposit({ who, where, how: [ZERO_ADDRESS] })).to.be.true
      })

      it('accepts withdrawals to allowed recipients', async () => {
        const [withdrawer0, withdrawer1] = toAddresses(agreement.withdrawers)
        expect(await agreement.canWithdraw({ who, where, how: [withdrawer0] })).to.be.true
        expect(await agreement.canWithdraw({ who, where, how: [withdrawer1] })).to.be.true

        const [manager0, manager1] = toAddresses(agreement.managers)
        expect(await agreement.canWithdraw({ who, where, how: [manager0] })).to.be.false
        expect(await agreement.canWithdraw({ who, where, how: [manager1] })).to.be.false

        const collector = toAddress(agreement.feeCollector)
        expect(await agreement.canWithdraw({ who, where, how: [collector] })).to.be.false
      })

      it('accepts operating with allowed tokens', async () => {
        const unknownToken = tokens.addresses[3]
        const whitelistedToken = tokens.second.address
        await agreement.vault.setWhitelistedTokens(whitelistedToken)

        // valid token out, valid slippage
        expect(await agreement.canSwap({ who, where, how: [unknownToken, customToken.address, fp(10), maxSwapSlippage] })).to.be.true
        // valid token out, invalid slippage
        expect(await agreement.canSwap({ who, where, how: [unknownToken, customToken.address, fp(10), maxSwapSlippage.add(1)] })).to.be.false
        // invalid token out, valid slippage
        expect(await agreement.canSwap({ who, where, how: [unknownToken, whitelistedToken, fp(10), maxSwapSlippage] })).to.be.false
        // invalid token out, invalid slippage
        expect(await agreement.canSwap({ who, where, how: [unknownToken, whitelistedToken, fp(10), maxSwapSlippage.add(1)] })).to.be.false
        // invalid token out, valid slippage
        expect(await agreement.canSwap({ who, where, how: [customToken.address, unknownToken, fp(10), maxSwapSlippage] })).to.be.false
        // invalid token out, invalid slippage
        expect(await agreement.canSwap({ who, where, how: [customToken.address, unknownToken, fp(10), maxSwapSlippage.add(1)] })).to.be.false
      })

      it('accepts operating with allowed strategies', async () => {
        const whitelistedStrategy = await deploy('StrategyMock', [tokens.second.address])
        await agreement.vault.setWhitelistedStrategies(whitelistedStrategy)

        expect(await agreement.canJoin({ who, where, how: [customStrategy.address] })).to.be.true
        expect(await agreement.canJoin({ who, where, how: [whitelistedStrategy.address] })).to.be.false

        expect(await agreement.canExit({ who, where, how: [customStrategy.address] })).to.be.true
        expect(await agreement.canExit({ who, where, how: [whitelistedStrategy.address] })).to.be.false
      })

      it('does not accept any other action', async () => {
        expect(await agreement.canPerform({ who, where })).to.be.false
        expect(await agreement.canPerform({ who, where, how: [ZERO_ADDRESS] })).to.be.false
      })
    }

    context('when the sender is not allowed', () => {
      beforeEach('set sender', async () => (who = await getSigner(10)))

      context('when the target is the vault', () => {
        beforeEach('set target', () => (where = agreement.vault.address))

        itDoesNotAcceptAnyAction()
      })

      context('when the target is not the vault', () => {
        beforeEach('set target', () => (where = ZERO_ADDRESS))

        itDoesNotAcceptAnyAction()
      })
    })

    context('when the sender is a manager', () => {
      beforeEach('set sender', async () => (who = agreement.managers[0]))

      context('when the target is the vault', () => {
        beforeEach('set target', () => (where = agreement.vault.address))

        itAcceptsAllowedActions()
      })

      context('when the target is not the vault', () => {
        beforeEach('set target', () => (where = ZERO_ADDRESS))

        itDoesNotAcceptAnyAction()
      })
    })

    context('when the sender is a withdrawer', () => {
      beforeEach('set sender', async () => (who = agreement.withdrawers[1]))

      context('when the target is the vault', () => {
        beforeEach('set target', () => (where = agreement.vault.address))

        itAcceptsAllowedActions()
      })

      context('when the target is not the vault', () => {
        beforeEach('set target', () => (where = ZERO_ADDRESS))

        itDoesNotAcceptAnyAction()
      })
    })
  })

  describe('callbacks', () => {
    let agreement: Agreement

    beforeEach('deploy agreement', async () => {
      agreement = await Agreement.create({ vault: 'mocked' })
    })

    it('supports only before deposit and withdraw', async () => {
      const callbacks = await agreement.getSupportedCallbacks()
      expect(callbacks).to.be.equal('0x0005')
    })

    describe('before deposit', () => {
      context('when the sender is the vault', () => {
        it('grants infinite allowance for all tokens', async () => {
          const previousTokenAllowances = await tokens.allowance(agreement.address, agreement.vault.address)
          previousTokenAllowances.forEach((allowance) => expect(allowance).to.be.equal(0))

          await agreement.vault.instance.mockBeforeDeposit(agreement.address, ZERO_ADDRESS, tokens.addresses, [])

          const currentTokenAllowances = await tokens.allowance(agreement.address, agreement.vault.address)
          currentTokenAllowances.forEach((allowance) => expect(allowance).to.be.equal(MAX_UINT256))
        })
      })

      context('when the sender is not the vault', () => {
        beforeEach('deploy agreement', async () => {
          agreement = await Agreement.create()
        })

        it('reverts', async () => {
          await expect(agreement.instance.beforeDeposit(ZERO_ADDRESS, [], [])).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })

    describe('before withdraw', () => {
      context('when the sender is the vault', () => {
        it('grants infinite allowance for all tokens', async () => {
          const previousTokenAllowances = await tokens.allowance(agreement.address, agreement.vault.address)
          previousTokenAllowances.forEach((allowance) => expect(allowance).to.be.equal(0))

          await agreement.vault.instance.mockBeforeWithdraw(agreement.address, ZERO_ADDRESS, tokens.addresses, [], ZERO_ADDRESS)

          const currentTokenAllowances = await tokens.allowance(agreement.address, agreement.vault.address)
          currentTokenAllowances.forEach((allowance) => expect(allowance).to.be.equal(MAX_UINT256))
        })
      })

      context('when the sender is not the vault', () => {
        beforeEach('deploy agreement', async () => {
          agreement = await Agreement.create()
        })

        it('reverts', async () => {
          await expect(agreement.instance.beforeWithdraw(ZERO_ADDRESS, [], [], ZERO_ADDRESS)).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })
})
