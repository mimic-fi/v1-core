import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { fp, deploy, getSigners } from '@octopus-fi/v1-helpers'

import Vault from '../helpers/models/vault/Vault'
import TokenList from '../helpers/models/tokens/TokenList'

describe('Vault', () => {
  let tokens: TokenList, vault: Vault, portfolio: Contract
  let account: SignerWithAddress, other: SignerWithAddress, admin: SignerWithAddress, feeCollector: SignerWithAddress

  const depositFee = fp(0.01)
  const protocolFee = fp(0.005)
  const performanceFee = fp(0.2)

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [admin, account, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy vault, tokens, and portfolio', async () => {
    vault = await Vault.create({ protocolFee, from: admin })
    tokens = await TokenList.create(2)
    portfolio = await deploy('PortfolioMock', [vault.address, depositFee, performanceFee, feeCollector.address])
  })

  describe('deposit', () => {
    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the sender has enough tokens', async () => {
          const amount = fp(500)

          beforeEach('mint tokens', async () => {
            await tokens.mint(account, amount)
          })

          context('when the sender has approved enough tokens', async () => {
            beforeEach('mint tokens', async () => {
              await tokens.approve(vault, amount, { from: account })
            })

            it('transfers the tokens to the vault', async () => {
              const previousVaultBalances = await tokens.balanceOf(vault)
              const previousAccountBalances = await tokens.balanceOf(account)

              await vault.deposit(account, tokens.addresses, amount, { from })

              const currentVaultBalances = await tokens.balanceOf(vault)
              currentVaultBalances.forEach((balance, i) => expect(balance).to.be.equal(previousVaultBalances[i].add(amount)))

              const currentAccountBalances = await tokens.balanceOf(account)
              currentAccountBalances.forEach((balance, i) => expect(balance).to.be.equal(previousAccountBalances[i].sub(amount)))
            })
          })

          context('when the sender did not approve enough tokens', async () => {
            it('reverts', async () => {
              await expect(vault.deposit(account, tokens.addresses, amount, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
          })
        })

        context('when the sender does not have enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.deposit(account, tokens.addresses, fp(10), { from })).to.be.revertedWith('ERC20: transfer amount exceeds balance')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.deposit(account, tokens.addresses, fp(10), { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })

    context('when the account is a portfolio', () => {
      let from: SignerWithAddress

      beforeEach('set sender', async () => {
        from = other
      })

      context('when the sender is allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(true)
        })

        context('when the portfolio has enough tokens', async () => {
          const amount = fp(500)

          beforeEach('mint tokens', async () => {
            await tokens.mint(portfolio, amount)
          })

          const itTransfersTheTokensToTheVault = () => {
            it('transfers the tokens to the vault charging deposit fees', async () => {
              const previousVaultBalances = await tokens.balanceOf(vault)
              const previousPortfolioBalances = await tokens.balanceOf(portfolio)
              const previousCollectorBalances = await tokens.balanceOf(feeCollector)

              await vault.deposit(portfolio, tokens.addresses, amount, { from })

              const expectedFees = amount.mul(depositFee).div(fp(1))
              const currentCollectorBalances = await tokens.balanceOf(feeCollector)
              currentCollectorBalances.forEach((balance, i) => expect(balance).to.be.equal(previousCollectorBalances[i].add(expectedFees)))

              const currentVaultBalances = await tokens.balanceOf(vault)
              currentVaultBalances.forEach((balance, i) => expect(balance).to.be.equal(previousVaultBalances[i].add(amount).sub(expectedFees)))

              const currentPortfolioBalances = await tokens.balanceOf(portfolio)
              currentPortfolioBalances.forEach((balance, i) => expect(balance).to.be.equal(previousPortfolioBalances[i].sub(amount)))
            })
          }

          context('when the sender has approved enough tokens', async () => {
            beforeEach('mint tokens', async () => {
              await portfolio.approveTokens(tokens.addresses)
            })

            itTransfersTheTokensToTheVault()
          })

          context('when the portfolio did not approve enough tokens', async () => {
            itTransfersTheTokensToTheVault()
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.deposit(portfolio, tokens.addresses, fp(10), { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })

  describe('withdraw', () => {
    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the sender has deposited enough tokens', async () => {
          const amount = fp(500)

          beforeEach('deposit tokens', async () => {
            await tokens.mint(account, amount)
            await tokens.approve(vault, amount, { from: account })
            await vault.deposit(account, tokens.addresses, amount, { from: account })
          })

          it('transfers the tokens to the recipient', async () => {
            const previousVaultBalances = await tokens.balanceOf(vault)
            const previousRecipientBalances = await tokens.balanceOf(other)

            await vault.withdraw(account, tokens.addresses, amount, other, { from })

            const currentVaultBalances = await tokens.balanceOf(vault)
            currentVaultBalances.forEach((balance, i) => expect(balance).to.be.equal(previousVaultBalances[i].sub(amount)))

            const currentRecipientBalances = await tokens.balanceOf(other)
            currentRecipientBalances.forEach((balance, i) => expect(balance).to.be.equal(previousRecipientBalances[i].add(amount)))
          })
        })

        context('when the sender did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.withdraw(account, tokens.addresses, fp(10), other, { from })).to.be.revertedWith('ACCOUNT_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.withdraw(account, tokens.addresses, fp(10), other, { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })

    context('when the account is a portfolio', () => {
      let from: SignerWithAddress

      beforeEach('set sender', async () => {
        from = other
      })

      context('when the sender is allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(true)
        })

        context('when the portfolio has deposited enough tokens', async () => {
          const amount = fp(500)

          beforeEach('deposit tokens', async () => {
            const expectedFee = amount.mul(fp(1)).div(fp(1).sub(depositFee))
            const depositedAmount = amount.add(expectedFee)
            await tokens.mint(portfolio, depositedAmount)
            await vault.deposit(portfolio, tokens.addresses, depositedAmount, { from })
          })

          it('transfers the tokens to the recipient', async () => {
            const previousVaultBalances = await tokens.balanceOf(vault)
            const previousRecipientBalances = await tokens.balanceOf(portfolio)

            await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

            const currentVaultBalances = await tokens.balanceOf(vault)
            currentVaultBalances.forEach((balance, i) => expect(balance).to.be.equal(previousVaultBalances[i].sub(amount)))

            const currentRecipientBalances = await tokens.balanceOf(other)
            currentRecipientBalances.forEach((balance, i) => expect(balance).to.be.equal(previousRecipientBalances[i].add(amount)))
          })
        })

        context('when the portfolio did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.withdraw(portfolio, tokens.addresses, fp(10), other, { from })).to.be.revertedWith('ACCOUNT_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.withdraw(portfolio, tokens.addresses, fp(10), other, { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })

  describe('join', () => {
    // TODO: implement
  })

  describe('join swap', () => {
    // TODO: implement
  })

  describe('exit', () => {
    // TODO: implement
  })

  describe('batch', () => {
    // TODO: implement
  })

  describe('set protocol fee', () => {
    // TODO: implement
  })

  describe('set swap connector', () => {
    // TODO: implement
  })

  describe('set whitelisted strategies', () => {
    // TODO: implement
  })
})
