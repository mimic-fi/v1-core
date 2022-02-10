import { defaultAbiCoder } from '@ethersproject/abi'
import { BigNumberish, deploy, fp, getSigner, getSigners, ZERO_ADDRESS } from '@mimic-fi/v1-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import Agreement from './helpers/Agreement'
import { Account, toAddress, toAddresses } from './helpers/types'

describe('Agreement', () => {
  describe('withdrawers', () => {
    context('when using non-zero address', async () => {
      it('marks them as allowed senders', async () => {
        const withdrawers = await getSigners(2)
        const agreement = await Agreement.create({ withdrawers })

        expect(await agreement.areWithdrawers(withdrawers)).to.be.true
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

  describe('withdraw fee', () => {
    context('when using a zero fee', async () => {
      const withdrawFee = 0

      it('accepts the fee', async () => {
        const agreement = await Agreement.create({ withdrawFee })

        const { fee } = await agreement.getWithdrawFee()
        expect(fee).to.be.equal(withdrawFee)
      })
    })

    context('when using a fee between zero and the maximum allowed', async () => {
      const withdrawFee = fp(0.5)

      it('accepts the fee', async () => {
        const agreement = await Agreement.create({ withdrawFee })

        const { fee } = await agreement.getWithdrawFee()
        expect(fee).to.be.equal(withdrawFee)
      })
    })

    context('when using a fee above the maximum allowed', async () => {
      const withdrawFee = fp(1).add(1)

      it('reverts', async () => {
        await expect(Agreement.create({ withdrawFee })).to.be.revertedWith('WITHDRAW_FEE_TOO_HIGH')
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
    let vault: Contract, customStrategy: Contract, unknownStrategy: Contract, whitelistedStrategy: Contract

    beforeEach('deploy strategies and vault', async () => {
      vault = await deploy('VaultMock')
      customStrategy = await deploy('StrategyMock')
      unknownStrategy = await deploy('StrategyMock')
      whitelistedStrategy = await deploy('StrategyMock')
      await vault.mockWhitelistedStrategies([whitelistedStrategy.address])
    })

    context('when allowing any', () => {
      const allowedStrategies = 'any'

      context('without a custom set', () => {
        it('allows any strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isStrategyAllowed(customStrategy)).to.be.true
          expect(await agreement.isStrategyAllowed(unknownStrategy)).to.be.true
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })

      context('with a custom set', () => {
        it('allows any strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [customStrategy], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isStrategyAllowed(customStrategy)).to.be.true
          expect(await agreement.isStrategyAllowed(unknownStrategy)).to.be.true
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })
    })

    context('when allowing only custom', () => {
      const allowedStrategies = 'onlyCustom'

      context('without a custom set', () => {
        it('does not any strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(customStrategy)).to.be.false
          expect(await agreement.isStrategyAllowed(unknownStrategy)).to.be.false
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.false
        })
      })

      context('with a custom set', () => {
        it('allows only the custom strategies', async () => {
          const agreement = await Agreement.create({ vault, strategies: [customStrategy], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(customStrategy)).to.be.true
          expect(await agreement.isStrategyAllowed(unknownStrategy)).to.be.false
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.false
        })
      })
    })

    context('when allowing custom and whitelisted', () => {
      const allowedStrategies = 'customAndWhitelisted'

      context('without a custom set', () => {
        it('allows any whitelisted strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(customStrategy)).to.be.false
          expect(await agreement.isStrategyAllowed(unknownStrategy)).to.be.false
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })

      context('with a custom set', () => {
        it('allows any whitelisted and custom strategy', async () => {
          const agreement = await Agreement.create({ vault, strategies: [customStrategy], allowedStrategies })

          expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isStrategyAllowed(customStrategy)).to.be.true
          expect(await agreement.isStrategyAllowed(unknownStrategy)).to.be.false
          expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
        })
      })
    })
  })

  describe('tokens', () => {
    let vault: Contract, customToken: Contract, unknownToken: Contract, whitelistedToken: Contract

    beforeEach('deploy tokens and vault', async () => {
      vault = await deploy('VaultMock')
      customToken = await deploy('TokenMock')
      unknownToken = await deploy('TokenMock')
      whitelistedToken = await deploy('TokenMock')
      await vault.mockWhitelistedTokens([whitelistedToken.address])
    })

    context('when allowing any', () => {
      const allowedTokens = 'any'

      context('without a custom set of tokens', () => {
        it('allows any token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isTokenAllowed(customToken)).to.be.true
          expect(await agreement.isTokenAllowed(unknownToken)).to.be.true
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })

      context('with a custom set of tokens', () => {
        it('allows any token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [customToken], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.true
          expect(await agreement.isTokenAllowed(customToken)).to.be.true
          expect(await agreement.isTokenAllowed(unknownToken)).to.be.true
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })
    })

    context('when allowing only custom', () => {
      const allowedTokens = 'onlyCustom'

      context('without a custom set of tokens', () => {
        it('does not allow any token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customToken)).to.be.false
          expect(await agreement.isTokenAllowed(unknownToken)).to.be.false
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.false
        })
      })

      context('with a custom set of tokens', () => {
        it('allows only the custom tokens', async () => {
          const agreement = await Agreement.create({ vault, tokens: [customToken], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customToken)).to.be.true
          expect(await agreement.isTokenAllowed(unknownToken)).to.be.false
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.false
        })
      })
    })

    context('when allowing custom and whitelisted', () => {
      const allowedTokens = 'customAndWhitelisted'

      context('without a custom set of tokens', () => {
        it('allows any whitelisted token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customToken)).to.be.false
          expect(await agreement.isTokenAllowed(unknownToken)).to.be.false
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })

      context('with a custom set of tokens', () => {
        it('allows any whitelisted and custom token', async () => {
          const agreement = await Agreement.create({ vault, tokens: [customToken], allowedTokens })

          expect(await agreement.isTokenAllowed(ZERO_ADDRESS)).to.be.false
          expect(await agreement.isTokenAllowed(customToken)).to.be.true
          expect(await agreement.isTokenAllowed(unknownToken)).to.be.false
          expect(await agreement.isTokenAllowed(whitelistedToken)).to.be.true
        })
      })
    })
  })

  describe('can perform', () => {
    let who: Account, where: string
    let agreement: Agreement, weth: Contract, vault: Contract, customStrategy: Contract, customToken: Contract

    const maxSwapSlippage = fp(0.2)

    beforeEach('deploy agreement', async () => {
      weth = await deploy('WethMock')
      vault = await deploy('VaultMock')
      customToken = await deploy('TokenMock')
      customStrategy = await deploy('StrategyMock')
      agreement = await Agreement.create({
        weth,
        vault,
        allowedStrategies: 'onlyCustom',
        strategies: [customStrategy],
        allowedTokens: 'onlyCustom',
        tokens: [customToken],
        maxSwapSlippage,
      })
    })

    const itDoesNotAcceptAnyAction = () => {
      it('does not accept any actions', async () => {
        expect(await agreement.canPerform(who, where)).to.be.false

        expect(await agreement.canDeposit(who, where)).to.be.false
        expect(await agreement.canDeposit(who, where, ZERO_ADDRESS, 0)).to.be.false

        expect(await agreement.canWithdraw(who, where)).to.be.false
        expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, 0, ZERO_ADDRESS)).to.be.false

        expect(await agreement.canSwap(who, where)).to.be.false
        expect(await agreement.canSwap(who, where, ZERO_ADDRESS, ZERO_ADDRESS, 0, 0, '0x')).to.be.false

        expect(await agreement.canJoin(who, where)).to.be.false
        expect(await agreement.canJoin(who, where, ZERO_ADDRESS, 0, '0x')).to.be.false

        expect(await agreement.canExit(who, where)).to.be.false
        expect(await agreement.canExit(who, where, ZERO_ADDRESS, 0, false, '0x')).to.be.false
      })
    }

    context('when the sender is not allowed', () => {
      beforeEach('set sender', async () => (who = await getSigner(10)))

      context('when the target is the vault', () => {
        beforeEach('set target', () => (where = vault.address))

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
        beforeEach('set target', () => (where = vault.address))

        it('accepts any deposit', async () => {
          expect(await agreement.canDeposit(who, where)).to.be.true
          expect(await agreement.canDeposit(who, where, ZERO_ADDRESS, fp(1))).to.be.true
        })

        it('accepts withdrawals to allowed recipients', async () => {
          const [withdrawer0, withdrawer1] = toAddresses(agreement.withdrawers)
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), withdrawer0)).to.be.true
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), withdrawer1)).to.be.true

          const [manager0, manager1] = toAddresses(agreement.managers)
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), manager0)).to.be.false
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), manager1)).to.be.false

          const collector = toAddress(agreement.feeCollector)
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), collector)).to.be.false
        })

        it('accepts withdrawals to the agreement itself if sending weth with an encoded withdrawer', async () => {
          const [withdrawer0, withdrawer1] = toAddresses(agreement.withdrawers)

          const encodedWithdrawer0 = defaultAbiCoder.encode(['address'], [withdrawer0])
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), agreement.address, encodedWithdrawer0)).to
            .be.false
          expect(await agreement.canWithdraw(who, where, weth.address, fp(1), agreement.address, encodedWithdrawer0)).to
            .be.true

          const encodedWithdrawer1 = defaultAbiCoder.encode(['address'], [withdrawer1])
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), agreement.address, encodedWithdrawer1)).to
            .be.false
          expect(await agreement.canWithdraw(who, where, weth.address, fp(1), agreement.address, encodedWithdrawer1)).to
            .be.true

          const encodedManager0 = defaultAbiCoder.encode(['address'], [toAddress(agreement.managers[0])])
          expect(await agreement.canWithdraw(who, where, ZERO_ADDRESS, fp(1), agreement.address)).to.be.false
          expect(await agreement.canWithdraw(who, where, weth.address, fp(1), agreement.address)).to.be.false
          expect(await agreement.canWithdraw(who, where, weth.address, fp(1), agreement.address, encodedManager0)).to.be
            .false
        })

        it('accepts operating with allowed tokens', async () => {
          const unknownToken = await deploy('TokenMock')
          const whitelistedToken = await deploy('TokenMock')
          await vault.mockWhitelistedTokens([whitelistedToken.address])

          // valid token out, valid slippage
          expect(await agreement.canSwap(who, where, unknownToken, customToken.address, fp(10), maxSwapSlippage)).to.be
            .true
          // valid token out, invalid slippage
          expect(await agreement.canSwap(who, where, unknownToken, customToken.address, fp(10), maxSwapSlippage.add(1)))
            .to.be.false
          // invalid token out, valid slippage
          expect(await agreement.canSwap(who, where, unknownToken, whitelistedToken.address, fp(10), maxSwapSlippage))
            .to.be.false
          // invalid token out, invalid slippage
          expect(
            await agreement.canSwap(who, where, unknownToken, whitelistedToken.address, fp(10), maxSwapSlippage.add(1))
          ).to.be.false
          // invalid token out, valid slippage
          expect(await agreement.canSwap(who, where, customToken.address, unknownToken, fp(10), maxSwapSlippage)).to.be
            .false
          // invalid token out, invalid slippage
          expect(await agreement.canSwap(who, where, customToken.address, unknownToken, fp(10), maxSwapSlippage.add(1)))
            .to.be.false
        })

        it('accepts joining only allowed strategies', async () => {
          const unknownStrategy = await deploy('StrategyMock')
          const whitelistedStrategy = await deploy('StrategyMock')
          await vault.mockWhitelistedStrategies([whitelistedStrategy.address])

          expect(await agreement.canJoin(who, where, customStrategy.address)).to.be.true
          expect(await agreement.canJoin(who, where, unknownStrategy.address)).to.be.false
          expect(await agreement.canJoin(who, where, whitelistedStrategy.address)).to.be.false
        })

        it('accepts exiting any strategies', async () => {
          const unknownStrategy = await deploy('StrategyMock')
          const whitelistedStrategy = await deploy('StrategyMock')
          await vault.mockWhitelistedStrategies([whitelistedStrategy.address])

          expect(await agreement.canExit(who, where, customStrategy.address)).to.be.true
          expect(await agreement.canExit(who, where, unknownStrategy.address)).to.be.true
          expect(await agreement.canExit(who, where, whitelistedStrategy.address)).to.be.true
        })

        it('accepts exiting strategies on emergency only if also a withdrawer', async () => {
          const onlyManager = agreement.managers[1] // third manager is also a withdrawer
          const alsoWithdrawer = agreement.managers[2] // third manager is also a withdrawer

          const unknownStrategy = await deploy('StrategyMock')
          const whitelistedStrategy = await deploy('StrategyMock')
          await vault.mockWhitelistedStrategies([whitelistedStrategy.address])

          expect(await agreement.canExit(onlyManager, where, customStrategy.address, 0, true)).to.be.false
          expect(await agreement.canExit(onlyManager, where, unknownStrategy.address, 0, true)).to.be.false
          expect(await agreement.canExit(onlyManager, where, whitelistedStrategy.address, 0, true)).to.be.false

          expect(await agreement.canExit(alsoWithdrawer, where, customStrategy.address, 0, true)).to.be.true
          expect(await agreement.canExit(alsoWithdrawer, where, unknownStrategy.address, 0, true)).to.be.true
          expect(await agreement.canExit(alsoWithdrawer, where, whitelistedStrategy.address, 0, true)).to.be.true
        })

        it('does not accept any other action', async () => {
          expect(await agreement.canPerform(who, where)).to.be.false
        })
      })

      context('when the target is not the vault', () => {
        beforeEach('set target', () => (where = ZERO_ADDRESS))

        itDoesNotAcceptAnyAction()
      })
    })

    context('when the sender is a withdrawer', () => {
      beforeEach('set sender', async () => (who = agreement.withdrawers[1]))

      context('when the target is the vault', () => {
        beforeEach('set target', () => (where = vault.address))

        itDoesNotAcceptAnyAction()
      })

      context('when the target is not the vault', () => {
        beforeEach('set target', () => (where = ZERO_ADDRESS))

        itDoesNotAcceptAnyAction()
      })
    })
  })

  describe('callbacks', () => {
    let agreement: Agreement, vault: Contract, token: Contract, weth: Contract

    beforeEach('deploy agreement', async () => {
      weth = await deploy('WethMock')
      token = await deploy('TokenMock')
      vault = await deploy('VaultMock')
      agreement = await Agreement.create({ weth, vault })
    })

    it('supports only before deposit and withdraw', async () => {
      const callbacks = await agreement.getSupportedCallbacks()
      expect(callbacks).to.be.equal('0x000d')
    })

    describe('before deposit', () => {
      context('when the sender is the vault', () => {
        it('grants allowance for the given token and amount', async () => {
          const previousTokenAllowance = await token.allowance(agreement.address, vault.address)
          expect(previousTokenAllowance).to.be.equal(0)

          await vault.mockBeforeDeposit(agreement.address, ZERO_ADDRESS, token.address, 10, '0x')

          const currentTokenAllowance = await token.allowance(agreement.address, vault.address)
          expect(currentTokenAllowance).to.be.equal(10)
        })
      })

      context('when the sender is not the vault', () => {
        beforeEach('deploy agreement', async () => {
          agreement = await Agreement.create()
        })

        it('reverts', async () => {
          await expect(agreement.instance.beforeDeposit(ZERO_ADDRESS, ZERO_ADDRESS, 0, '0x')).to.be.revertedWith(
            'SENDER_NOT_VAULT'
          )
        })
      })
    })

    describe('before withdraw', () => {
      context('when the sender is the vault', () => {
        beforeEach('mint tokens', async () => {
          await token.mint(agreement.address, 5)
        })

        context('when requesting more than the agreement balance', () => {
          const amount = 10

          it('grants allowance for the current balance', async () => {
            const previousTokenAllowance = await token.allowance(agreement.address, vault.address)
            expect(previousTokenAllowance).to.be.equal(0)

            await vault.mockBeforeWithdraw(agreement.address, ZERO_ADDRESS, token.address, amount, ZERO_ADDRESS, '0x')

            const currentTokenAllowance = await token.allowance(agreement.address, vault.address)
            expect(currentTokenAllowance).to.be.equal(5)
          })
        })

        context('when requesting less than the agreement balance', () => {
          const amount = 3

          it('grants allowance for the requested amount', async () => {
            const previousTokenAllowance = await token.allowance(agreement.address, vault.address)
            expect(previousTokenAllowance).to.be.equal(0)

            await vault.mockBeforeWithdraw(agreement.address, ZERO_ADDRESS, token.address, amount, ZERO_ADDRESS, '0x')

            const currentTokenAllowance = await token.allowance(agreement.address, vault.address)
            expect(currentTokenAllowance).to.be.equal(amount)
          })
        })
      })

      context('when the sender is not the vault', () => {
        beforeEach('deploy agreement', async () => {
          agreement = await Agreement.create()
        })

        it('reverts', async () => {
          await expect(
            agreement.instance.beforeWithdraw(ZERO_ADDRESS, ZERO_ADDRESS, 0, ZERO_ADDRESS, '0x')
          ).to.be.revertedWith('SENDER_NOT_VAULT')
        })
      })
    })

    describe('after withdraw', () => {
      let recipient: string, withdrawer: SignerWithAddress

      beforeEach('define signer', async () => {
        withdrawer = await getSigner(2)
      })

      context('when the sender is the vault', () => {
        context('when the token is WETH', () => {
          const balance = fp(10)

          beforeEach('deposit weth into the agreement', async () => {
            await weth.deposit({ value: balance })
            await weth.transfer(agreement.address, balance)
          })

          context('when the recipient is the agreement', () => {
            beforeEach('set agreement as recipient', () => {
              recipient = agreement.address
            })

            context('when there is a withdrawer encoded', () => {
              let data: string

              beforeEach('encode withdrawer', async () => {
                data = defaultAbiCoder.encode(['address'], [withdrawer.address])
              })

              context('when the amount is greater than zero', () => {
                const amount = balance

                context('when there is enough balance in the agreement', () => {
                  beforeEach('deposit weth into the agreement', async () => {
                    await weth.deposit({ value: amount })
                    await weth.transfer(agreement.address, amount)
                  })

                  it('unwraps the given weth and sends it to the default withdrawer', async () => {
                    const previousEthBalance = await ethers.provider.getBalance(withdrawer.address)
                    const previousWethBalance = await weth.balanceOf(agreement.address)

                    await vault.mockAfterWithdraw(
                      agreement.address,
                      ZERO_ADDRESS,
                      weth.address,
                      amount,
                      recipient,
                      data
                    )

                    const currentEthBalance = await ethers.provider.getBalance(withdrawer.address)
                    expect(currentEthBalance).to.be.equal(previousEthBalance.add(amount))

                    const currentWethBalance = await weth.balanceOf(agreement.address)
                    expect(currentWethBalance).to.be.equal(previousWethBalance.sub(amount))
                  })
                })

                context('when there is not enough balance in the agreement', () => {
                  const amount = balance.add(1)

                  it('reverts', async () => {
                    await expect(
                      vault.mockAfterWithdraw(agreement.address, ZERO_ADDRESS, weth.address, amount, recipient, data)
                    ).to.be.revertedWith('NOT_ENOUGH_BALANCE')
                  })
                })
              })

              context('when the amount is zero', () => {
                const amount = 0

                it('ignores the request', async () => {
                  const previousEthBalance = await ethers.provider.getBalance(withdrawer.address)
                  const previousWethBalance = await weth.balanceOf(agreement.address)

                  await vault.mockAfterWithdraw(agreement.address, ZERO_ADDRESS, weth.address, amount, recipient, data)

                  expect(await ethers.provider.getBalance(withdrawer.address)).to.be.equal(previousEthBalance)
                  expect(await weth.balanceOf(agreement.address)).to.be.equal(previousWethBalance)
                })
              })
            })

            context('when there is no withdrawer encoded', () => {
              const data = '0x'

              it('unwraps the given weth and sends it to the zero address', async () => {
                const previousEthBalance = await ethers.provider.getBalance(ZERO_ADDRESS)
                const previousWethBalance = await weth.balanceOf(agreement.address)

                await vault.mockAfterWithdraw(agreement.address, ZERO_ADDRESS, weth.address, balance, recipient, data)

                const currentEthBalance = await ethers.provider.getBalance(ZERO_ADDRESS)
                expect(currentEthBalance).to.be.equal(previousEthBalance.add(balance))

                const currentWethBalance = await weth.balanceOf(agreement.address)
                expect(currentWethBalance).to.be.equal(previousWethBalance.sub(balance))
              })
            })
          })

          context('when the recipient is not the agreement', () => {
            beforeEach('set agreement as recipient', () => {
              recipient = withdrawer.address
            })

            it('ignores the request', async () => {
              const previousEthBalance = await ethers.provider.getBalance(withdrawer.address)
              const previousWethBalance = await weth.balanceOf(agreement.address)

              await vault.mockAfterWithdraw(agreement.address, ZERO_ADDRESS, weth.address, fp(10), recipient, '0x')

              expect(await ethers.provider.getBalance(withdrawer.address)).to.be.equal(previousEthBalance)
              expect(await weth.balanceOf(agreement.address)).to.be.equal(previousWethBalance)
            })
          })
        })

        context('when the token is not WETH', () => {
          it('ignores the request', async () => {
            const previousEthBalance = await ethers.provider.getBalance(withdrawer.address)
            const previousWethBalance = await token.balanceOf(agreement.address)

            await vault.mockAfterWithdraw(agreement.address, ZERO_ADDRESS, token.address, fp(10), recipient, '0x')

            expect(await ethers.provider.getBalance(withdrawer.address)).to.be.equal(previousEthBalance)
            expect(await token.balanceOf(agreement.address)).to.be.equal(previousWethBalance)
          })
        })
      })

      context('when the sender is not the vault', () => {
        beforeEach('deploy agreement', async () => {
          agreement = await Agreement.create()
        })

        it('reverts', async () => {
          await expect(
            agreement.instance.afterWithdraw(ZERO_ADDRESS, ZERO_ADDRESS, 0, ZERO_ADDRESS, '0x')
          ).to.be.revertedWith('SENDER_NOT_VAULT')
        })
      })
    })
  })

  describe('withdraw', () => {
    let manager: SignerWithAddress, withdrawer: SignerWithAddress
    let agreement: Agreement, vault: Contract, token: Contract, swapConnector: Contract, priceOracle: Contract

    beforeEach('deploy agreement', async () => {
      // eslint-disable-next-line prettier/prettier
      [, manager, withdrawer] = await getSigners()

      token = await deploy('TokenMock')
      priceOracle = await deploy('TokenMock')
      swapConnector = await deploy('TokenMock')

      vault = await deploy('@mimic-fi/v1-vault/artifacts/contracts/Vault.sol/Vault', [
        fp(0.1),
        fp(0.1),
        swapConnector.address,
        priceOracle.address,
        [],
        [],
      ])

      agreement = await Agreement.create({ vault, withdrawers: [withdrawer], managers: [manager] })
    })

    it('can withdraw any tokens', async () => {
      const amount = fp(100)
      await token.mint(agreement.address, amount)
      expect(await token.balanceOf(agreement.address)).to.be.equal(amount)

      await vault.connect(manager).deposit(agreement.address, token.address, amount, '0x')
      expect(await token.balanceOf(vault.address)).to.be.equal(amount)

      await vault.connect(manager).withdraw(agreement.address, token.address, amount, withdrawer.address, '0x')
      expect(await token.balanceOf(withdrawer.address)).to.be.equal(amount)
    })
  })

  describe('ETH', () => {
    let manager: SignerWithAddress, withdrawer: SignerWithAddress
    let agreement: Agreement, vault: Contract, weth: Contract, swapConnector: Contract, priceOracle: Contract

    beforeEach('deploy agreement', async () => {
      // eslint-disable-next-line prettier/prettier
      [, manager, withdrawer] = await getSigners()

      weth = await deploy('WethMock')
      priceOracle = await deploy('TokenMock')
      swapConnector = await deploy('TokenMock')

      vault = await deploy('@mimic-fi/v1-vault/artifacts/contracts/Vault.sol/Vault', [
        fp(0.1),
        fp(0.1),
        swapConnector.address,
        priceOracle.address,
        [],
        [],
      ])

      agreement = await Agreement.create({ weth, vault, withdrawers: [withdrawer], managers: [manager] })
    })

    const assertBalance = async (account: Account, expectedEth: BigNumberish, expectedWeth: BigNumberish) => {
      const address = typeof account == 'string' ? account : account.address
      expect(await weth.balanceOf(address)).to.be.equal(expectedWeth)
      expect(await ethers.provider.getBalance(address)).to.be.equal(expectedEth)
    }

    it('can handle ETH deposits', async () => {
      await assertBalance(vault, 0, 0)
      await assertBalance(agreement, 0, 0)

      const amount = fp(1)
      await manager.sendTransaction({ to: agreement.address, value: amount })
      await assertBalance(vault, 0, 0)
      await assertBalance(agreement, amount, 0)

      await vault.connect(manager).deposit(agreement.address, weth.address, amount, '0x')
      await assertBalance(vault, 0, amount)
      await assertBalance(agreement, 0, 0)
    })

    it('can handle WETH withdraws', async () => {
      const previousBalance = await ethers.provider.getBalance(withdrawer.address)

      const amount = fp(1)
      await manager.sendTransaction({ to: agreement.address, value: amount })
      await vault.connect(manager).deposit(agreement.address, weth.address, amount, '0x')

      await vault.connect(manager).withdraw(agreement.address, weth.address, amount, withdrawer.address, '0x')
      await assertBalance(vault, 0, 0)
      await assertBalance(agreement, 0, 0)

      expect(await weth.balanceOf(withdrawer.address)).to.be.equal(amount)
      expect(await ethers.provider.getBalance(withdrawer.address)).to.be.equal(previousBalance)
    })

    it('can handle ETH withdraws', async () => {
      const previousBalance = await ethers.provider.getBalance(withdrawer.address)

      const amount = fp(1)
      await manager.sendTransaction({ to: agreement.address, value: amount })
      await vault.connect(manager).deposit(agreement.address, weth.address, amount, '0x')

      const encodedWithdrawer = defaultAbiCoder.encode(['address'], [withdrawer.address])
      await vault
        .connect(manager)
        .withdraw(agreement.address, weth.address, amount, agreement.address, encodedWithdrawer)

      await assertBalance(vault, 0, 0)
      await assertBalance(agreement, 0, 0)

      expect(await weth.balanceOf(withdrawer.address)).to.be.equal(0)
      expect(await ethers.provider.getBalance(withdrawer.address)).to.be.equal(previousBalance.add(amount))
    })
  })
})
