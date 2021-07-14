import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { fp } from '../../../helpers/src/numbers'
import { deploy } from '../../../helpers/src/contracts'
import { getSigner, getSigners } from '../../../helpers/src/signers'
import { MAX_UINT256, ZERO_ADDRESS } from '../../../helpers/src/constants'
import { Account, toAddress, toAddresses } from '../helpers/models/types'

import Vault from '../helpers/models/vault/Vault'
import TokenList from '../helpers/models/tokens/TokenList'
import Agreement from '../helpers/models/agreement/Agreement'

describe('Agreement', () => {
  let tokens: TokenList

  beforeEach('deploy tokens', async () => {
    tokens = await TokenList.create(2)
  })

  describe('withdrawers', () => {
    context('when using non-zero address', async () => {
      it('marks them as allowed senders', async () => {
        const withdrawers = await getSigners(2)
        const agreement = await Agreement.create({ withdrawers })

        expect(await agreement.getWithdrawers()).to.have.members([withdrawers[0].address, withdrawers[1].address])
        expect(await agreement.areWithdrawers(withdrawers)).to.be.true
        expect(await agreement.areAllowedSenders(withdrawers)).to.be.true
      })
    })

    context('when using a zero address', async () => {
      it('reverts', async () => {
        const withdrawers = [ZERO_ADDRESS, ZERO_ADDRESS]

        await expect(Agreement.create({ withdrawers })).to.be.revertedWith('WITHDRAWER_ZERO_ADDRESS')
      })
    })
  })

  describe('managers', () => {
    context('when using non-zero address', async () => {
      it('marks them as allowed senders', async () => {
        const managers = await getSigners(2)
        const agreement = await Agreement.create({ managers })

        expect(await agreement.getManagers()).to.have.members([managers[0].address, managers[1].address])
        expect(await agreement.areManagers(managers)).to.be.true
        expect(await agreement.areAllowedSenders(managers)).to.be.true
      })
    })

    context('when using a zero address', async () => {
      it('reverts', async () => {
        const managers = [ZERO_ADDRESS, ZERO_ADDRESS]

        await expect(Agreement.create({ managers })).to.be.revertedWith('MANAGER_ZERO_ADDRESS')
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

  describe('strategies', () => {
    let strategies: Contract[]

    context('when using up-to 10 custom strategies', () => {
      let vault: Vault, whitelistedStrategy: Contract

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
            const agreement = await Agreement.create({ vault, allowedStrategies, strategies: [] })

            expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.true
            expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
            expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true
            expect(await agreement.isStrategyAllowed(strategies[2])).to.be.true
            expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
          })
        })

        context('with a custom set', () => {
          it('reverts', async () => {
            await expect(Agreement.create({ vault, allowedStrategies, strategies })).to.be.revertedWith('ANY_WITH_CUSTOM_STRATEGIES')
          })
        })
      })

      context('when allowing none', () => {
        const allowedStrategies = 'none'

        context('without a custom set', () => {
          it('does not any strategy', async () => {
            const agreement = await Agreement.create({ vault, allowedStrategies, strategies: [] })

            expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[0])).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[1])).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[2])).to.be.false
            expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.false
          })
        })

        context('with a custom set', () => {
          it('allows only the custom strategies', async () => {
            const agreement = await Agreement.create({ vault, allowedStrategies, strategies })

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
            const agreement = await Agreement.create({ vault, allowedStrategies, strategies: [] })

            expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[0])).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[1])).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[2])).to.be.false
            expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
          })
        })

        context('with a custom set', () => {
          it('allows any whitelisted and custom strategy', async () => {
            const agreement = await Agreement.create({ vault, allowedStrategies, strategies })

            expect(await agreement.isStrategyAllowed(ZERO_ADDRESS)).to.be.false
            expect(await agreement.isStrategyAllowed(strategies[0])).to.be.true
            expect(await agreement.isStrategyAllowed(strategies[1])).to.be.true
            expect(await agreement.isStrategyAllowed(strategies[2])).to.be.true
            expect(await agreement.isStrategyAllowed(whitelistedStrategy)).to.be.true
          })
        })
      })
    })

    context('when using more than 8 custom strategies', () => {
      beforeEach('deploy strategies', async () => {
        strategies = []
        for (let i = 0; i < 9; i++) strategies.push(await deploy('StrategyMock', [tokens.first.address]))
      })

      it('reverts', async () => {
        await expect(Agreement.create({ strategies })).to.be.revertedWith('TOO_MANY_CUSTOM_STRATEGIES')
      })
    })
  })

  describe('can perform', () => {
    let agreement: Agreement, who: Account, where: string, customStrategy: Contract

    beforeEach('deploy agreement', async () => {
      customStrategy = await deploy('StrategyMock', [tokens.first.address])
      agreement = await Agreement.create({ allowedStrategies: 'none', strategies: [customStrategy] })
    })

    const itDoesNotAcceptAnyAction = () => {
      it('does not accept any actions', async () => {
        expect(await agreement.canPerform({ who, where })).to.be.false
        expect(await agreement.canPerform({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canDeposit({ who, where })).to.be.false
        expect(await agreement.canDeposit({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canWithdraw({ who, where })).to.be.false
        expect(await agreement.canWithdraw({ who, where, how: [ZERO_ADDRESS] })).to.be.false

        expect(await agreement.canJoinSwap({ who, where })).to.be.false
        expect(await agreement.canJoinSwap({ who, where, how: [ZERO_ADDRESS] })).to.be.false

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

      it('accepts operating with allowed strategies', async () => {
        const whitelistedStrategy = await deploy('StrategyMock', [tokens.first.address])
        await agreement.vault.setWhitelistedStrategies(whitelistedStrategy)

        expect(await agreement.canJoinSwap({ who, where, how: [customStrategy.address] })).to.be.true
        expect(await agreement.canJoinSwap({ who, where, how: [whitelistedStrategy.address] })).to.be.false

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
      beforeEach('set sender', async () => (who = agreement.manager0))

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
      beforeEach('set sender', async () => (who = agreement.withdrawer1))

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

  describe('approveTokens', () => {
    let agreement: Agreement

    context('when the sender is the vault', () => {
      beforeEach('deploy agreement', async () => {
        agreement = await Agreement.create({ vault: 'mocked' })
      })

      it('grants infinite allowance for all tokens', async () => {
        const previousTokenAllowances = await tokens.allowance(agreement.address, agreement.vault.address)
        previousTokenAllowances.forEach((allowance) => expect(allowance).to.be.equal(0))

        await agreement.vault.instance.mockApproveTokens(agreement.address, tokens.addresses)

        const currentTokenAllowances = await tokens.allowance(agreement.address, agreement.vault.address)
        currentTokenAllowances.forEach((allowance) => expect(allowance).to.be.equal(MAX_UINT256))
      })
    })

    context('when the sender is not the vault', () => {
      beforeEach('deploy agreement', async () => {
        agreement = await Agreement.create()
      })

      it('reverts', async () => {
        await expect(agreement.approveTokens(tokens.addresses)).to.be.revertedWith('SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('withdraw', () => {
    let agreement: Agreement

    beforeEach('deploy agreement', async () => {
      agreement = await Agreement.create()
    })

    context('when the sender is allowed', () => {
      let from: SignerWithAddress

      const itWithdrawsProperly = () => {
        let withdrawer: string
        const amount = fp(10)

        context('when the given withdrawer is allowed', () => {
          beforeEach('set withdrawer', () => (withdrawer = agreement.withdrawer0))

          context('when there is enough balance', () => {
            beforeEach('mint tokens', async () => {
              await tokens.mint(agreement.address, amount)
            })

            it('withdraws the tokens to the withdrawer', async () => {
              const previousVaultBalances = await tokens.balanceOf(agreement.vault)
              const previousAgreementBalances = await tokens.balanceOf(agreement.address)
              const previousWithdrawerBalances = await tokens.balanceOf(withdrawer)

              await agreement.withdraw(withdrawer, tokens.addresses, amount, { from })

              const currentVaultBalances = await tokens.balanceOf(agreement.address)
              currentVaultBalances.forEach((balance, i) => expect(balance).to.be.equal(previousVaultBalances[i]))

              const currentAgreementBalances = await tokens.balanceOf(agreement.address)
              currentAgreementBalances.forEach((balance, i) => expect(balance).to.be.equal(previousAgreementBalances[i].sub(amount)))

              const currentWithdrawerBalances = await tokens.balanceOf(withdrawer)
              currentWithdrawerBalances.forEach((balance, i) => expect(balance).to.be.equal(previousWithdrawerBalances[i].add(amount)))
            })
          })

          context('when there is not enough balance', () => {
            beforeEach('mint some tokens', async () => {
              await tokens.mint(agreement.address, amount.div(2))
            })

            context('when there is enough balance in the vault', () => {
              beforeEach('deposit tokens in vault', async () => {
                await tokens.mint(agreement.address, amount.div(2))
                await agreement.vault.deposit(agreement, tokens.addresses, amount.div(2), { from })
              })

              it('withdraws the tokens to the withdrawer', async () => {
                const previousVaultBalances = await tokens.balanceOf(agreement.vault)
                const previousAgreementBalances = await tokens.balanceOf(agreement)
                const previousWithdrawerBalances = await tokens.balanceOf(withdrawer)

                await agreement.withdraw(withdrawer, tokens.addresses, amount, { from })

                const currentVaultBalances = await tokens.balanceOf(agreement.address)
                currentVaultBalances.forEach((balance, i) => expect(balance).to.be.equal(previousVaultBalances[i].sub(amount.div(2))))

                const currentAgreementBalances = await tokens.balanceOf(agreement.address)
                currentAgreementBalances.forEach((balance, i) => expect(balance).to.be.equal(previousAgreementBalances[i].sub(amount.div(2))))

                const currentWithdrawerBalances = await tokens.balanceOf(withdrawer)
                currentWithdrawerBalances.forEach((balance, i) => expect(balance).to.be.equal(previousWithdrawerBalances[i].add(amount)))
              })
            })

            context('when there is not enough balance in the vault either', () => {
              it('reverts', async () => {
                await expect(agreement.withdraw(withdrawer, tokens.addresses, amount, { from })).to.be.revertedWith('ACCOUNT_INSUFFICIENT_BALANCE')
              })
            })
          })
        })

        context('when the given withdrawer is not allowed', () => {
          beforeEach('set withdrawer', () => (withdrawer = agreement.manager0))

          it('reverts', async () => {
            const amounts = Array(tokens.length).fill(fp(10))

            await expect(agreement.withdraw(withdrawer, tokens.addresses, amounts)).to.be.revertedWith('SENDER_NOT_ALLOWED')
          })
        })
      }

      context('when the sender is a withdrawer', () => {
        beforeEach('set sender', () => {
          from = agreement.withdrawers[0] as SignerWithAddress
        })

        itWithdrawsProperly()
      })

      context('when the sender is a manager', () => {
        beforeEach('set sender', () => {
          from = agreement.managers[1] as SignerWithAddress
        })

        itWithdrawsProperly()
      })
    })

    context('when the sender is allowed', () => {
      it('reverts', async () => {
        const withdrawer = agreement.withdrawer0
        const amounts = Array(tokens.length).fill(fp(10))

        await expect(agreement.withdraw(withdrawer, tokens.addresses, amounts)).to.be.revertedWith('SENDER_NOT_ALLOWED')
      })
    })
  })
})
