import { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { fp, deploy, getSigners, assertEvent, BigNumberish, ZERO_ADDRESS, MAX_UINT256, assertIndirectEvent, assertNoIndirectEvent } from '@mimic-fi/v1-helpers'

import Vault from '../helpers/models/vault/Vault'
import Token from '../helpers/models/tokens/Token'
import TokenList from '../helpers/models/tokens/TokenList'

describe('Vault', () => {
  let tokens: TokenList, vault: Vault, portfolio: Contract
  let account: SignerWithAddress, other: SignerWithAddress, admin: SignerWithAddress, feeCollector: SignerWithAddress

  const depositFee = fp(0.01)
  const protocolFee = fp(0.0005)
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
            beforeEach('approve tokens', async () => {
              await tokens.approve(vault, amount, { from: account })
            })

            it('transfers the tokens to the vault', async () => {
              const previousVaultBalances = await tokens.balanceOf(vault)
              const previousAccountBalances = await tokens.balanceOf(account)

              await vault.deposit(account, tokens.addresses, amount, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentVaultBalance = await token.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalances[i].add(amount))

                const currentAccountBalance = await token.balanceOf(account)
                expect(currentAccountBalance).to.be.equal(previousAccountBalances[i].sub(amount))
              })
            })

            it('increases the account available balance in the vault', async () => {
              const previousBalances = await tokens.asyncMap((token) => vault.getAccountBalance(account, token))

              await vault.deposit(account, tokens.addresses, amount, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentBalance = await vault.getAccountBalance(account, token)
                expect(currentBalance).to.be.equal(previousBalances[i].add(amount))
              })
            })

            it('emits an event', async () => {
              const tx = await vault.deposit(account, tokens.addresses, amount, { from })

              await assertEvent(tx, 'Deposit', {
                account,
                tokens: tokens.addresses,
                amounts: Array(tokens.length).fill(amount),
                depositFees: Array(tokens.length).fill(fp(0)),
                caller: from,
              })
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
          const expectedFee = amount.mul(depositFee).div(fp(1))

          beforeEach('mint tokens', async () => {
            await tokens.mint(portfolio, amount)
          })

          const itTransfersTheTokensToTheVault = () => {
            it('transfers the tokens to the vault charging deposit fees', async () => {
              const previousVaultBalances = await tokens.balanceOf(vault)
              const previousPortfolioBalances = await tokens.balanceOf(portfolio)
              const previousCollectorBalances = await tokens.balanceOf(feeCollector)

              await vault.deposit(portfolio, tokens.addresses, amount, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentCollectorBalance = await token.balanceOf(feeCollector)
                expect(currentCollectorBalance).to.be.equal(previousCollectorBalances[i].add(expectedFee))

                const currentVaultBalance = await token.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalances[i].add(amount).sub(expectedFee))

                const currentPortfolioBalance = await token.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalances[i].sub(amount))
              })
            })

            it('increases the account available balance in the vault', async () => {
              const previousBalances = await tokens.asyncMap((token) => vault.getAccountBalance(portfolio, token))

              await vault.deposit(portfolio, tokens.addresses, amount, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentBalance = await vault.getAccountBalance(portfolio, token)
                expect(currentBalance).to.be.equal(previousBalances[i].add(amount).sub(expectedFee))
              })
            })

            it('emits an event', async () => {
              const tx = await vault.deposit(portfolio, tokens.addresses, amount, { from })

              await assertEvent(tx, 'Deposit', {
                account: portfolio,
                tokens: tokens.addresses,
                amounts: Array(tokens.length).fill(amount),
                depositFees: Array(tokens.length).fill(expectedFee),
                caller: from,
              })
            })

            describe('callbacks', async () => {
              context('when non is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x00')
                })

                it('does not call the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, tokens.addresses, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeDeposit')
                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterDeposit')
                })
              })

              context('when before is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x01')
                })

                it('only calls before to the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, tokens.addresses, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterDeposit')
                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeDeposit', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                  })
                })
              })

              context('when after is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x02')
                })

                it('only calls after to the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, tokens.addresses, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeDeposit')
                  await assertIndirectEvent(tx, portfolio.interface, 'AfterDeposit', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                  })
                })
              })

              context('when both are allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x03')
                })

                it('calls before and after to the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, tokens.addresses, amount, { from })

                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeDeposit', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                  })

                  await assertIndirectEvent(tx, portfolio.interface, 'AfterDeposit', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                  })
                })
              })
            })
          }

          context('when the sender has approved enough tokens', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(tokens.addresses, MAX_UINT256)
            })

            itTransfersTheTokensToTheVault()
          })

          context('when the portfolio did not approve enough tokens', async () => {
            it('reverts', async () => {
              await expect(vault.deposit(portfolio, tokens.addresses, amount, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
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
    const amount = fp(500)

    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the sender has deposited enough tokens', async () => {
          beforeEach('deposit tokens', async () => {
            await tokens.mint(account, amount)
            await tokens.approve(vault, amount, { from: account })
            await vault.deposit(account, tokens.addresses, amount, { from: account })
          })

          it('transfers the tokens to the recipient', async () => {
            const previousVaultBalances = await tokens.balanceOf(vault)
            const previousRecipientBalances = await tokens.balanceOf(other)

            await vault.withdraw(account, tokens.addresses, amount, other, { from })

            await tokens.asyncEach(async (token, i) => {
              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalances[i].sub(amount))

              const currentRecipientBalance = await token.balanceOf(other)
              expect(currentRecipientBalance).to.be.equal(previousRecipientBalances[i].add(amount))
            })
          })

          it('decreases the account available balance in the vault', async () => {
            const previousBalances = await tokens.asyncMap((token) => vault.getAccountBalance(account, token))

            await vault.withdraw(account, tokens.addresses, amount, other, { from })

            await tokens.asyncEach(async (token, i) => {
              const currentBalance = await vault.getAccountBalance(account, token)
              expect(currentBalance).to.be.equal(previousBalances[i].sub(amount))
            })
          })

          it('emits an event', async () => {
            const tx = await vault.withdraw(account, tokens.addresses, amount, other, { from })

            await assertEvent(tx, 'Withdraw', {
              account,
              tokens: tokens.addresses,
              amounts: Array(tokens.length).fill(amount),
              recipient: other,
              caller: from,
            })
          })
        })

        context('when the sender did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.withdraw(account, tokens.addresses, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.withdraw(account, tokens.addresses, amount, other, { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
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

        context('when the portfolio has enough balance', async () => {
          beforeEach('mint tokens', async () => {
            await tokens.mint(portfolio, amount)
          })

          context('when the portfolio has allowed the corresponding amount', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(tokens.addresses, amount)
            })

            it('transfers the tokens to the recipient', async () => {
              const previousVaultBalances = await tokens.balanceOf(vault)
              const previousPortfolioBalances = await tokens.balanceOf(portfolio)
              const previousRecipientBalances = await tokens.balanceOf(other)

              await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentVaultBalance = await token.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalances[i])

                const currentPortfolioBalance = await token.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalances[i].sub(amount))

                const currentRecipientBalance = await token.balanceOf(other)
                expect(currentRecipientBalance).to.be.equal(previousRecipientBalances[i].add(amount))
              })
            })

            it('does not affect the account available balance in the vault', async () => {
              const previousBalances = await tokens.asyncMap((token) => vault.getAccountBalance(portfolio, token))

              await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentBalance = await vault.getAccountBalance(portfolio, token)
                expect(currentBalance).to.be.equal(previousBalances[i])
              })
            })

            it('emits an event', async () => {
              const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

              await assertEvent(tx, 'Withdraw', {
                account: portfolio,
                tokens: tokens.addresses,
                amounts: Array(tokens.length).fill(amount),
                fromVault: Array(tokens.length).fill(fp(0)),
                recipient: other,
                caller: from,
              })
            })

            describe('callbacks', async () => {
              context('when non is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x00')
                })

                it('does not call the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw')
                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterWithdraw')
                })
              })

              context('when before is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x04')
                })

                it('only calls before to the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterWithdraw')
                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                    recipient: other,
                  })
                })
              })

              context('when after is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x08')
                })

                it('only calls after to the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw')
                  await assertIndirectEvent(tx, portfolio.interface, 'AfterWithdraw', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                    recipient: other,
                  })
                })
              })

              context('when both are allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0C')
                })

                it('calls before and after to the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                    recipient: other,
                  })

                  await assertIndirectEvent(tx, portfolio.interface, 'AfterWithdraw', {
                    sender: from,
                    tokens: tokens.addresses,
                    amounts: Array(tokens.length).fill(amount),
                    recipient: other,
                  })
                })
              })
            })
          })

          context('when the portfolio did not allow the corresponding amount', async () => {
            it('reverts', async () => {
              await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
          })
        })

        context('when the portfolio does not have enough balance', async () => {
          beforeEach('mint tokens', async () => {
            await tokens.mint(portfolio, amount.div(2))
          })

          context('when the portfolio has allowed the corresponding amount', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(tokens.addresses, MAX_UINT256)
            })

            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await tokens.mint(portfolio, depositedAmount)
                await vault.deposit(portfolio, tokens.addresses, depositedAmount, { from })
              })

              it('transfers the tokens to the recipient', async () => {
                const previousVaultBalances = await tokens.balanceOf(vault)
                const previousPortfolioBalances = await tokens.balanceOf(portfolio)
                const previousRecipientBalances = await tokens.balanceOf(other)

                await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                await tokens.asyncEach(async (token, i) => {
                  const currentVaultBalance = await token.balanceOf(vault)
                  expect(currentVaultBalance).to.be.equal(previousVaultBalances[i].sub(amount.div(2)))

                  const currentPortfolioBalance = await token.balanceOf(portfolio)
                  expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalances[i].sub(amount.div(2)))

                  const currentRecipientBalance = await token.balanceOf(other)
                  expect(currentRecipientBalance).to.be.equal(previousRecipientBalances[i].add(amount))
                })
              })

              it('decreases the account available balance in the vault', async () => {
                const previousBalances = await tokens.asyncMap((token) => vault.getAccountBalance(portfolio, token))

                await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                await tokens.asyncEach(async (token, i) => {
                  const currentBalance = await vault.getAccountBalance(portfolio, token)
                  expect(currentBalance).to.be.equal(previousBalances[i].sub(amount.div(2)))
                })
              })

              it('emits an event', async () => {
                const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

                await assertEvent(tx, 'Withdraw', {
                  account: portfolio,
                  tokens: tokens.addresses,
                  amounts: Array(tokens.length).fill(amount),
                  fromVault: Array(tokens.length).fill(amount.div(2)),
                  recipient: other,
                  caller: from,
                })
              })
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })

          context('when the portfolio did not allow the corresponding amount', async () => {
            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await portfolio.mockApproveTokens(tokens.addresses, depositedAmount)
                await tokens.mint(portfolio, depositedAmount)
                await vault.deposit(portfolio, tokens.addresses, depositedAmount, { from })
              })

              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
              })
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })
        })

        context('when the portfolio does not have balance at all', async () => {
          const itWithdrawsTokensFromVault = () => {
            it('transfers the tokens to the recipient', async () => {
              const previousVaultBalances = await tokens.balanceOf(vault)
              const previousPortfolioBalances = await tokens.balanceOf(portfolio)
              const previousRecipientBalances = await tokens.balanceOf(other)

              await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentVaultBalance = await token.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalances[i].sub(amount))

                const currentPortfolioBalance = await token.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalances[i])

                const currentRecipientBalance = await token.balanceOf(other)
                expect(currentRecipientBalance).to.be.equal(previousRecipientBalances[i].add(amount))
              })
            })

            it('decreases the account available balance in the vault', async () => {
              const previousBalances = await tokens.asyncMap((token) => vault.getAccountBalance(portfolio, token))

              await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

              await tokens.asyncEach(async (token, i) => {
                const currentBalance = await vault.getAccountBalance(portfolio, token)
                expect(currentBalance).to.be.equal(previousBalances[i].sub(amount))
              })
            })

            it('emits an event', async () => {
              const tx = await vault.withdraw(portfolio, tokens.addresses, amount, other, { from })

              await assertEvent(tx, 'Withdraw', {
                account: portfolio,
                tokens: tokens.addresses,
                amounts: Array(tokens.length).fill(amount),
                fromVault: Array(tokens.length).fill(amount),
                recipient: other,
                caller: from,
              })
            })
          }

          context('when the portfolio has allowed the vault', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(tokens.addresses, MAX_UINT256)
            })

            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await tokens.mint(portfolio, depositedAmount)
                await vault.deposit(portfolio, tokens.addresses, depositedAmount, { from })
              })

              itWithdrawsTokensFromVault()
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })

          context('when the portfolio did not allow the vault', async () => {
            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await tokens.mint(portfolio, depositedAmount)
                await portfolio.mockApproveTokens(tokens.addresses, depositedAmount)
                await vault.deposit(portfolio, tokens.addresses, depositedAmount, { from })
              })

              itWithdrawsTokensFromVault()
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.withdraw(portfolio, tokens.addresses, amount, other, { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })

  describe('join', () => {
    let strategy: Contract, token: Token

    beforeEach('deploy strategy', async () => {
      token = tokens.first
      strategy = await deploy('StrategyMock', [token.address])
    })

    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the sender has deposited enough tokens', async () => {
          const amount = fp(500)

          beforeEach('deposit tokens', async () => {
            await token.mint(account, amount)
            await token.approve(vault, amount, { from: account })
            await vault.deposit(account, token, amount, { from: account })
          })

          const itJoinsAsExpected = (rate: BigNumberish) => {
            const expectedShares = amount.mul(rate).div(fp(1))

            beforeEach('mock strategy rate', async () => {
              await strategy.mockRate(rate)
            })

            it('transfers the tokens to the strategy', async () => {
              const previousVaultBalance = await token.balanceOf(vault)
              const previousAccountBalance = await token.balanceOf(account)
              const previousStrategyBalance = await token.balanceOf(strategy)

              await vault.join(account, strategy, amount, { from })

              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

              const currentAccountBalance = await token.balanceOf(account)
              expect(currentAccountBalance).to.be.equal(previousAccountBalance)

              const currentStrategyBalance = await token.balanceOf(strategy)
              expect(currentStrategyBalance).to.be.equal(previousStrategyBalance.add(amount))
            })

            it('decreases the account available balance in the vault', async () => {
              const previousBalance = await vault.getAccountBalance(account, token)

              await vault.join(account, strategy, amount, { from })

              const currentBalance = await vault.getAccountBalance(account, token)
              expect(currentBalance).to.be.equal(previousBalance.sub(amount))
            })

            it('increases the account invested balance in the vault', async () => {
              const previousInvestment = await vault.getAccountInvestment(account, strategy)

              await vault.join(account, strategy, amount, { from })

              const currentInvestment = await vault.getAccountInvestment(account, strategy)
              expect(currentInvestment.invested).to.be.equal(previousInvestment.invested.add(amount))
              expect(currentInvestment.shares).to.be.equal(previousInvestment.shares.add(expectedShares))
            })

            it('allocates the expected number of shares to the user', async () => {
              const previousShares = await strategy.getTotalShares()

              await vault.join(account, strategy, amount, { from })

              const currentShares = await strategy.getTotalShares()
              expect(currentShares).to.be.equal(previousShares.add(expectedShares))
            })

            it('emits an event', async () => {
              const tx = await vault.join(account, strategy, amount, { from })

              await assertEvent(tx, 'Join', {
                account,
                strategy,
                amount,
                shares: expectedShares,
                caller: from,
              })
            })
          }

          context('with a rate lower than one', async () => {
            const rate = fp(0.99)
            itJoinsAsExpected(rate)
          })

          context('with a rate equal to one', async () => {
            const rate = fp(1)
            itJoinsAsExpected(rate)
          })

          context('with a rate higher to one', async () => {
            const rate = fp(1.01)
            itJoinsAsExpected(rate)
          })
        })

        context('when the sender did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.join(account, strategy, fp(10), { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.join(account, strategy, fp(10), { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
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
            const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
            await token.mint(portfolio, depositedAmount)
            await portfolio.mockApproveTokens(tokens.addresses, depositedAmount)
            await vault.deposit(portfolio, token, depositedAmount, { from })
          })

          const itJoinsAsExpected = (rate: BigNumberish) => {
            const expectedShares = amount.mul(rate).div(fp(1))

            beforeEach('mock strategy rate', async () => {
              await strategy.mockRate(rate)
            })

            it('transfers the tokens to the strategy', async () => {
              const previousVaultBalance = await token.balanceOf(vault)
              const previousStrategyBalance = await token.balanceOf(strategy)
              const previousPortfolioBalance = await token.balanceOf(portfolio)

              await vault.join(portfolio, strategy, amount, { from })

              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

              const currentPortfolioBalance = await token.balanceOf(portfolio)
              expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

              const currentStrategyBalance = await token.balanceOf(strategy)
              expect(currentStrategyBalance).to.be.equal(previousStrategyBalance.add(amount))
            })

            it('decreases the account available balance in the vault', async () => {
              const previousBalance = await vault.getAccountBalance(portfolio, token)

              await vault.join(portfolio, strategy, amount, { from })

              const currentBalance = await vault.getAccountBalance(portfolio, token)
              expect(currentBalance).to.be.equal(previousBalance.sub(amount))
            })

            it('increases the account invested balance in the vault', async () => {
              const previousInvestment = await vault.getAccountInvestment(portfolio, strategy)

              await vault.join(portfolio, strategy, amount, { from })

              const currentInvestment = await vault.getAccountInvestment(portfolio, strategy)
              expect(currentInvestment.invested).to.be.equal(previousInvestment.invested.add(amount))
              expect(currentInvestment.shares).to.be.equal(previousInvestment.shares.add(expectedShares))
            })

            it('allocates the expected number of shares to the account', async () => {
              const previousShares = await strategy.getTotalShares()

              await vault.join(portfolio, strategy, amount, { from })

              const currentShares = await strategy.getTotalShares()
              expect(currentShares).to.be.equal(previousShares.add(expectedShares))
            })

            it('emits an event', async () => {
              const tx = await vault.join(portfolio, strategy, amount, { from })

              await assertEvent(tx, 'Join', {
                account: portfolio,
                strategy,
                amount,
                shares: expectedShares,
                caller: from,
              })
            })
          }

          context('with a rate lower than one', async () => {
            const rate = fp(0.99)

            itJoinsAsExpected(rate)

            describe('callbacks', async () => {
              context('when non is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x00')
                })

                it('does not call the portfolio', async () => {
                  const tx = await vault.join(portfolio, strategy, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeJoin')
                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterJoin')
                })
              })

              context('when before is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x10')
                })

                it('only calls before to the portfolio', async () => {
                  const tx = await vault.join(portfolio, strategy, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterJoin')
                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeJoin', {
                    sender: from,
                    strategy,
                    data: '0x',
                  })
                })
              })

              context('when after is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x20')
                })

                it('only calls after to the portfolio', async () => {
                  const tx = await vault.join(portfolio, strategy, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeJoin')
                  await assertIndirectEvent(tx, portfolio.interface, 'AfterJoin', {
                    sender: from,
                    strategy,
                    data: '0x',
                  })
                })
              })

              context('when both are allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x30')
                })

                it('calls before and after to the portfolio', async () => {
                  const tx = await vault.join(portfolio, strategy, amount, { from })

                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeJoin', {
                    sender: from,
                    strategy,
                    data: '0x',
                  })

                  await assertIndirectEvent(tx, portfolio.interface, 'AfterJoin', {
                    sender: from,
                    strategy,
                    data: '0x',
                  })
                })
              })
            })
          })

          context('with a rate equal to one', async () => {
            const rate = fp(1)
            itJoinsAsExpected(rate)
          })

          context('with a rate higher to one', async () => {
            const rate = fp(1.01)
            itJoinsAsExpected(rate)
          })
        })

        context('when the portfolio did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.join(portfolio, strategy, fp(10), { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.join(portfolio, strategy, fp(10), { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })

  describe('join swap', () => {
    let strategy: Contract, swapConnector: Contract, strategyToken: Token, joiningToken: Token

    const SWAP_RATE = fp(0.98)

    beforeEach('deploy strategy', async () => {
      strategyToken = tokens.first
      joiningToken = tokens.second
      strategy = await deploy('StrategyMock', [strategyToken.address])
    })

    beforeEach('mock swap rate', async () => {
      swapConnector = vault.swapConnector
      await swapConnector.mockRate(SWAP_RATE)
    })

    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the sender has deposited enough tokens', async () => {
          const amount = fp(500)
          const expectedAmountOut = amount.mul(SWAP_RATE).div(fp(1))

          beforeEach('deposit tokens', async () => {
            await joiningToken.mint(account, amount)
            await joiningToken.approve(vault, amount, { from: account })
            await vault.deposit(account, joiningToken, amount, { from: account })
          })

          beforeEach('fund swap connector', async () => {
            await strategyToken.mint(swapConnector, expectedAmountOut)
          })

          context('when the min amount out is correct', async () => {
            const minAmountOut = expectedAmountOut

            const itJoinsAsExpected = (rate: BigNumberish) => {
              const expectedShares = expectedAmountOut.mul(rate).div(fp(1))

              beforeEach('mock strategy rate', async () => {
                await strategy.mockRate(rate)
              })

              it('transfers the joining tokens to the swap connector', async () => {
                const previousVaultBalance = await joiningToken.balanceOf(vault)
                const previousAccountBalance = await joiningToken.balanceOf(account)
                const previousStrategyBalance = await joiningToken.balanceOf(strategy)
                const previousConnectorBalance = await joiningToken.balanceOf(swapConnector)

                await vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })

                const currentVaultBalance = await joiningToken.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

                const currentAccountBalance = await joiningToken.balanceOf(account)
                expect(currentAccountBalance).to.be.equal(previousAccountBalance)

                const currentStrategyBalance = await joiningToken.balanceOf(strategy)
                expect(currentStrategyBalance).to.be.equal(previousStrategyBalance)

                const currentConnectorBalance = await joiningToken.balanceOf(swapConnector)
                expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.add(amount))
              })

              it('transfers the strategy tokens to the strategy', async () => {
                const previousVaultBalance = await strategyToken.balanceOf(vault)
                const previousAccountBalance = await strategyToken.balanceOf(account)
                const previousStrategyBalance = await strategyToken.balanceOf(strategy)
                const previousConnectorBalance = await strategyToken.balanceOf(swapConnector)

                await vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })

                const currentVaultBalance = await strategyToken.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalance)

                const currentAccountBalance = await strategyToken.balanceOf(account)
                expect(currentAccountBalance).to.be.equal(previousAccountBalance)

                const currentStrategyBalance = await strategyToken.balanceOf(strategy)
                expect(currentStrategyBalance).to.be.equal(previousStrategyBalance.add(expectedAmountOut))

                const currentConnectorBalance = await strategyToken.balanceOf(swapConnector)
                expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.sub(expectedAmountOut))
              })

              it('decreases the account available balance of the joining token in the vault', async () => {
                const previousJoiningTokenBalance = await vault.getAccountBalance(account, joiningToken)
                const previousStrategyTokenBalance = await vault.getAccountBalance(account, strategyToken)

                await vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })

                const currentJoiningTokenBalance = await vault.getAccountBalance(account, joiningToken)
                expect(currentJoiningTokenBalance).to.be.equal(previousJoiningTokenBalance.sub(amount))

                const currentStrategyTokenBalance = await vault.getAccountBalance(account, strategyToken)
                expect(currentStrategyTokenBalance).to.be.equal(previousStrategyTokenBalance)
              })

              it('increases the account invested balance in the vault', async () => {
                const previousInvestment = await vault.getAccountInvestment(account, strategy)

                await vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })

                const currentInvestment = await vault.getAccountInvestment(account, strategy)
                expect(currentInvestment.invested).to.be.equal(previousInvestment.invested.add(expectedAmountOut))
                expect(currentInvestment.shares).to.be.equal(previousInvestment.shares.add(expectedShares))
              })

              it('allocates the expected number of shares to the user', async () => {
                const previousShares = await strategy.getTotalShares()

                await vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })

                const currentShares = await strategy.getTotalShares()
                expect(currentShares).to.be.equal(previousShares.add(expectedShares))
              })

              it('emits two events', async () => {
                const tx = await vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })

                await assertEvent(tx, 'Join', {
                  account,
                  strategy,
                  amount: expectedAmountOut,
                  shares: expectedShares,
                  caller: from,
                })

                await assertEvent(tx, 'Swap', {
                  account,
                  tokenIn: joiningToken,
                  tokenOut: strategyToken,
                  amountIn: amount,
                  amountOut: expectedAmountOut,
                  data: '0x',
                })
              })
            }

            context('with a rate lower than one', async () => {
              const rate = fp(0.99)
              itJoinsAsExpected(rate)
            })

            context('with a rate equal to one', async () => {
              const rate = fp(1)
              itJoinsAsExpected(rate)
            })

            context('with a rate higher to one', async () => {
              const rate = fp(1.01)
              itJoinsAsExpected(rate)
            })
          })

          context('when the min amount out is too high', async () => {
            const minAmountOut = expectedAmountOut.add(1)

            it('reverts', async () => {
              await expect(vault.joinSwap(account, strategy, amount, joiningToken, minAmountOut, { from })).to.be.revertedWith('SWAP_MIN_AMOUNT')
            })
          })
        })

        context('when the sender did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.joinSwap(account, strategy, fp(1), joiningToken, 0, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.joinSwap(account, strategy, fp(1), joiningToken, 0, { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
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
          const expectedAmountOut = amount.mul(SWAP_RATE).div(fp(1))

          beforeEach('deposit tokens', async () => {
            const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
            await joiningToken.mint(portfolio, depositedAmount)
            await portfolio.mockApproveTokens([joiningToken.address], depositedAmount)
            await vault.deposit(portfolio, joiningToken, depositedAmount, { from })
          })

          beforeEach('fund swap connector', async () => {
            await strategyToken.mint(swapConnector, expectedAmountOut)
          })

          context('when the min amount out is correct', async () => {
            const minAmountOut = expectedAmountOut

            const itJoinsAsExpected = (rate: BigNumberish) => {
              const expectedShares = expectedAmountOut.mul(rate).div(fp(1))

              beforeEach('mock strategy rate', async () => {
                await strategy.mockRate(rate)
              })

              it('transfers the joining tokens to the swap connector', async () => {
                const previousVaultBalance = await joiningToken.balanceOf(vault)
                const previousPortfolioBalance = await joiningToken.balanceOf(portfolio)
                const previousStrategyBalance = await joiningToken.balanceOf(strategy)
                const previousConnectorBalance = await joiningToken.balanceOf(swapConnector)

                await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                const currentVaultBalance = await joiningToken.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

                const currentPortfolioBalance = await joiningToken.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

                const currentStrategyBalance = await joiningToken.balanceOf(strategy)
                expect(currentStrategyBalance).to.be.equal(previousStrategyBalance)

                const currentConnectorBalance = await joiningToken.balanceOf(swapConnector)
                expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.add(amount))
              })

              it('transfers the strategy tokens to the strategy', async () => {
                const previousVaultBalance = await strategyToken.balanceOf(vault)
                const previousPortfolioBalance = await strategyToken.balanceOf(portfolio)
                const previousStrategyBalance = await strategyToken.balanceOf(strategy)
                const previousConnectorBalance = await strategyToken.balanceOf(swapConnector)

                await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                const currentVaultBalance = await strategyToken.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalance)

                const currentPortfolioBalance = await strategyToken.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

                const currentStrategyBalance = await strategyToken.balanceOf(strategy)
                expect(currentStrategyBalance).to.be.equal(previousStrategyBalance.add(expectedAmountOut))

                const currentConnectorBalance = await strategyToken.balanceOf(swapConnector)
                expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.sub(expectedAmountOut))
              })

              it('decreases the portfolio available balance of the joining token in the vault', async () => {
                const previousJoiningTokenBalance = await vault.getAccountBalance(portfolio, joiningToken)
                const previousStrategyTokenBalance = await vault.getAccountBalance(portfolio, strategyToken)

                await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                const currentJoiningTokenBalance = await vault.getAccountBalance(portfolio, joiningToken)
                expect(currentJoiningTokenBalance).to.be.equal(previousJoiningTokenBalance.sub(amount))

                const currentStrategyTokenBalance = await vault.getAccountBalance(portfolio, strategyToken)
                expect(currentStrategyTokenBalance).to.be.equal(previousStrategyTokenBalance)
              })

              it('increases the portfolio invested balance in the vault', async () => {
                const previousInvestment = await vault.getAccountInvestment(portfolio, strategy)

                await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                const currentInvestment = await vault.getAccountInvestment(portfolio, strategy)
                expect(currentInvestment.invested).to.be.equal(previousInvestment.invested.add(expectedAmountOut))
                expect(currentInvestment.shares).to.be.equal(previousInvestment.shares.add(expectedShares))
              })

              it('allocates the expected number of shares to the account', async () => {
                const previousShares = await strategy.getTotalShares()

                await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                const currentShares = await strategy.getTotalShares()
                expect(currentShares).to.be.equal(previousShares.add(expectedShares))
              })

              it('emits two events', async () => {
                const tx = await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                await assertEvent(tx, 'Join', {
                  account: portfolio,
                  strategy,
                  amount: expectedAmountOut,
                  shares: expectedShares,
                  caller: from,
                })

                await assertEvent(tx, 'Swap', {
                  account: portfolio,
                  tokenIn: joiningToken,
                  tokenOut: strategyToken,
                  amountIn: amount,
                  amountOut: expectedAmountOut,
                  data: '0x',
                })
              })
            }

            context('with a rate lower than one', async () => {
              const rate = fp(0.99)

              itJoinsAsExpected(rate)

              describe('callbacks', async () => {
                context('when non is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x00')
                  })

                  it('does not call the portfolio', async () => {
                    const tx = await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeJoin')
                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterJoin')
                  })
                })

                context('when before is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x10')
                  })

                  it('only calls before to the portfolio', async () => {
                    const tx = await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterJoin')
                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeJoin', {
                      sender: from,
                      strategy,
                      data: '0x',
                    })
                  })
                })

                context('when after is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x20')
                  })

                  it('only calls after to the portfolio', async () => {
                    const tx = await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeJoin')
                    await assertIndirectEvent(tx, portfolio.interface, 'AfterJoin', {
                      sender: from,
                      strategy,
                      data: '0x',
                    })
                  })
                })

                context('when both are allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x30')
                  })

                  it('calls before and after to the portfolio', async () => {
                    const tx = await vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })

                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeJoin', {
                      sender: from,
                      strategy,
                      data: '0x',
                    })

                    await assertIndirectEvent(tx, portfolio.interface, 'AfterJoin', {
                      sender: from,
                      strategy,
                      data: '0x',
                    })
                  })
                })
              })
            })

            context('with a rate equal to one', async () => {
              const rate = fp(1)
              itJoinsAsExpected(rate)
            })

            context('with a rate higher to one', async () => {
              const rate = fp(1.01)
              itJoinsAsExpected(rate)
            })
          })

          context('when the min amount out is too high', async () => {
            const minAmountOut = expectedAmountOut.add(1)

            it('reverts', async () => {
              await expect(vault.joinSwap(portfolio, strategy, amount, joiningToken, minAmountOut, { from })).to.be.revertedWith('SWAP_MIN_AMOUNT')
            })
          })
        })

        context('when the portfolio did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.joinSwap(portfolio, strategy, fp(1), joiningToken, 0, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.joinSwap(portfolio, strategy, fp(1), joiningToken, 0, { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })

  describe('exit', () => {
    let strategy: Contract, token: Token

    beforeEach('deploy strategy', async () => {
      token = tokens.first
      strategy = await deploy('StrategyMock', [token.address])
    })

    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the account has enough shares', async () => {
          const shares = fp(500)

          beforeEach('join strategy', async () => {
            const amount = shares // mocked rate is 1 initially
            await token.mint(account, amount)
            await token.approve(vault, amount, { from: account })
            await vault.deposit(account, token, amount, { from: account })
            await vault.join(account, strategy, amount, { from })
          })

          context('when the given ratio is valid', async () => {
            const ratio = fp(1)

            const itExitsAsExpected = (rate: BigNumber) => {
              const expectedAmount = shares.mul(fp(1)).div(rate)
              const gains = expectedAmount.gt(shares) ? expectedAmount.sub(shares) : fp(0)
              const expectedProtocolFee = gains.gt(0) ? gains.mul(protocolFee).div(fp(1)) : fp(0)
              const expectedAmountAfterFees = expectedAmount.sub(expectedProtocolFee)

              beforeEach('mock strategy rate', async () => {
                await strategy.mockRate(rate)
              })

              it('transfers the tokens to the vault', async () => {
                const previousVaultBalance = await token.balanceOf(vault)
                const previousAccountBalance = await token.balanceOf(account)
                const previousStrategyBalance = await token.balanceOf(strategy)

                await vault.exit(account, strategy, ratio, { from })

                const currentVaultBalance = await token.balanceOf(vault)
                const expectedVaultBalance = previousVaultBalance.add(expectedAmountAfterFees)
                expect(currentVaultBalance).to.be.at.least(expectedVaultBalance.sub(1))
                expect(currentVaultBalance).to.be.at.most(expectedVaultBalance.add(1))

                const currentAccountBalance = await token.balanceOf(account)
                expect(currentAccountBalance).to.be.equal(previousAccountBalance)

                const currentStrategyBalance = await token.balanceOf(strategy)
                expect(currentStrategyBalance).to.be.equal(previousStrategyBalance.sub(expectedAmount))
              })

              it('increases the account available balance in the vault', async () => {
                const previousBalance = await vault.getAccountBalance(account, token)

                await vault.exit(account, strategy, ratio, { from })

                const currentBalance = await vault.getAccountBalance(account, token)
                const expectedBalance = previousBalance.add(expectedAmountAfterFees)
                expect(currentBalance).to.be.at.least(expectedBalance.sub(1))
                expect(currentBalance).to.be.at.most(expectedBalance.add(1))
              })

              if (gains.gt(0)) {
                it('pays the protocol fees to the owner', async () => {
                  const previousOwnerBalance = await token.balanceOf(admin)

                  await vault.exit(account, strategy, ratio, { from })

                  const currentOwnerBalance = await token.balanceOf(admin)
                  const expectedBalance = previousOwnerBalance.add(expectedProtocolFee)
                  expect(currentOwnerBalance).to.be.at.least(expectedBalance.sub(1))
                  expect(currentOwnerBalance).to.be.at.most(expectedBalance.add(1))
                })
              } else {
                it('does not pay protocol fees', async () => {
                  const previousOwnerBalance = await token.balanceOf(admin)

                  await vault.exit(account, strategy, ratio, { from })

                  const currentOwnerBalance = await token.balanceOf(admin)
                  expect(currentOwnerBalance).to.be.equal(previousOwnerBalance)
                })
              }

              it('decreases the account invested balance in the vault', async () => {
                const previousInvestment = await vault.getAccountInvestment(account, strategy)

                await vault.exit(account, strategy, ratio, { from })

                const currentInvestment = await vault.getAccountInvestment(account, strategy)
                expect(currentInvestment.invested).to.be.equal(previousInvestment.invested.sub(shares))
                expect(currentInvestment.shares).to.be.equal(previousInvestment.shares.sub(shares))
              })

              it('redeems the expected number of shares of the account', async () => {
                const previousShares = await strategy.getTotalShares()

                await vault.exit(account, strategy, ratio, { from })

                const currentShares = await strategy.getTotalShares()
                expect(currentShares).to.be.equal(previousShares.sub(shares))
              })

              it('emits an event', async () => {
                const tx = await vault.exit(account, strategy, ratio, { from })

                await assertEvent(tx, 'Exit', {
                  account,
                  strategy,
                  amountInvested: shares,
                  // amountReceived: expectedAmountAfterFees, TODO: fix rounding
                  shares,
                  // protocolFee: expectedProtocolFee, TODO: fix rounding
                  performanceFee: 0,
                  caller: from,
                })
              })
            }

            context('when the user gain sth', async () => {
              const rate = fp(0.95)

              beforeEach('fund strategy with gains', async () => {
                await token.mint(strategy, shares)
              })

              itExitsAsExpected(rate)
            })

            context('when the user is even', async () => {
              const rate = fp(1)
              itExitsAsExpected(rate)
            })

            context('when the user losses', async () => {
              const rate = fp(1.05)
              itExitsAsExpected(rate)
            })
          })

          context('when the given ratio is not valid', async () => {
            const ratio = fp(10)

            it('reverts', async () => {
              await expect(vault.exit(account, strategy, ratio, { from })).to.be.revertedWith('INVALID_EXIT_RATIO')
            })
          })
        })

        context('when the account does not have enough shares', async () => {
          it('reverts', async () => {
            await expect(vault.exit(account, strategy, fp(1), { from })).to.be.revertedWith('EXIT_SHARES_ZERO')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.exit(account, strategy, fp(1), { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
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

        context('when the portfolio has enough shares', async () => {
          const shares = fp(500)

          beforeEach('join strategy', async () => {
            const amount = shares // mocked rate is 1 initially
            const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
            await token.mint(portfolio, depositedAmount)
            await portfolio.mockApproveTokens(tokens.addresses, depositedAmount)
            await vault.deposit(portfolio, token, depositedAmount, { from })
            await vault.join(portfolio, strategy, amount, { from })
          })

          context('when the given ratio is valid', async () => {
            const ratio = fp(1)

            const itExitsAsExpected = (rate: BigNumber) => {
              const expectedAmount = shares.mul(fp(1)).div(rate)
              const gains = expectedAmount.gt(shares) ? expectedAmount.sub(shares) : fp(0)
              const expectedProtocolFee = gains.gt(0) ? gains.mul(protocolFee).div(fp(1)) : fp(0)
              const expectedPerformanceFee = gains.gt(0) ? gains.sub(expectedProtocolFee).mul(performanceFee).div(fp(1)) : fp(0)
              const expectedAmountAfterFees = expectedAmount.sub(expectedProtocolFee).sub(expectedPerformanceFee)

              beforeEach('mock strategy rate', async () => {
                await strategy.mockRate(rate)
              })

              it('transfers the tokens to the vault', async () => {
                const previousVaultBalance = await token.balanceOf(vault)
                const previousPortfolioBalance = await token.balanceOf(portfolio)
                const previousStrategyBalance = await token.balanceOf(strategy)

                await vault.exit(portfolio, strategy, ratio, { from })

                const currentVaultBalance = await token.balanceOf(vault)
                const expectedVaultBalance = previousVaultBalance.add(expectedAmountAfterFees)
                expect(currentVaultBalance).to.be.at.least(expectedVaultBalance.sub(1))
                expect(currentVaultBalance).to.be.at.most(expectedVaultBalance.add(1))

                const currentPortfolioBalance = await token.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

                const currentStrategyBalance = await token.balanceOf(strategy)
                expect(currentStrategyBalance).to.be.equal(previousStrategyBalance.sub(expectedAmount))
              })

              if (gains.gt(0)) {
                it('pays the protocol fees to the owner', async () => {
                  const previousOwnerBalance = await token.balanceOf(admin)

                  await vault.exit(portfolio, strategy, ratio, { from })

                  const currentOwnerBalance = await token.balanceOf(admin)
                  const expectedOwnerBalance = previousOwnerBalance.add(expectedProtocolFee)
                  expect(currentOwnerBalance).to.be.at.least(expectedOwnerBalance.sub(1))
                  expect(currentOwnerBalance).to.be.at.most(expectedOwnerBalance.add(1))
                })

                it('pays the performance fees to the fee collector', async () => {
                  const previousCollectorBalance = await token.balanceOf(feeCollector)

                  await vault.exit(portfolio, strategy, ratio, { from })

                  const currentCollectorBalance = await token.balanceOf(feeCollector)
                  expect(currentCollectorBalance).to.be.equal(previousCollectorBalance.add(expectedPerformanceFee))
                })
              } else {
                it('does not pay protocol fees', async () => {
                  const previousOwnerBalance = await token.balanceOf(admin)

                  await vault.exit(portfolio, strategy, ratio, { from })

                  const currentOwnerBalance = await token.balanceOf(admin)
                  expect(currentOwnerBalance).to.be.equal(previousOwnerBalance)
                })

                it('does not pay performance fees', async () => {
                  const previousCollectorBalance = await token.balanceOf(feeCollector)

                  await vault.exit(portfolio, strategy, ratio, { from })

                  const currentCollectorBalance = await token.balanceOf(feeCollector)
                  expect(currentCollectorBalance).to.be.equal(previousCollectorBalance)
                })
              }

              it('increases the account available balance in the vault', async () => {
                const previousBalance = await vault.getAccountBalance(portfolio, token)

                await vault.exit(portfolio, strategy, ratio, { from })

                const currentBalance = await vault.getAccountBalance(portfolio, token)
                const expectedBalance = previousBalance.add(expectedAmountAfterFees)
                expect(currentBalance).to.be.at.least(expectedBalance.sub(1))
                expect(currentBalance).to.be.at.most(expectedBalance.add(1))
              })

              it('decreases the account invested balance in the vault', async () => {
                const previousInvestment = await vault.getAccountInvestment(portfolio, strategy)

                await vault.exit(portfolio, strategy, ratio, { from })

                const currentInvestment = await vault.getAccountInvestment(portfolio, strategy)
                expect(currentInvestment.invested).to.be.equal(previousInvestment.invested.sub(shares))
                expect(currentInvestment.shares).to.be.equal(previousInvestment.shares.sub(shares))
              })

              it('redeems the expected number of shares of the account', async () => {
                const previousShares = await strategy.getTotalShares()

                await vault.exit(portfolio, strategy, ratio, { from })

                const currentShares = await strategy.getTotalShares()
                expect(currentShares).to.be.equal(previousShares.sub(shares))
              })

              it('emits an event', async () => {
                const tx = await vault.exit(portfolio, strategy, ratio, { from })

                await assertEvent(tx, 'Exit', {
                  account: portfolio,
                  strategy,
                  amountInvested: shares,
                  // amountReceived: expectedAmountAfterFees, TODO: fix rounding
                  shares,
                  // protocolFee: expectedProtocolFee, TODO: fix rounding
                  // performanceFee: expectedPerformanceFee, TODO: fix rounding
                  caller: from,
                })
              })
            }

            context('when the user gain sth', async () => {
              const rate = fp(0.95)

              beforeEach('fund strategy with gains', async () => {
                await token.mint(strategy, shares)
              })

              itExitsAsExpected(rate)

              describe('callbacks', async () => {
                context('when non is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x00')
                  })

                  it('does not call the portfolio', async () => {
                    const tx = await vault.exit(portfolio, strategy, ratio, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeExit')
                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterExit')
                  })
                })

                context('when before is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x40')
                  })

                  it('only calls before to the portfolio', async () => {
                    const tx = await vault.exit(portfolio, strategy, ratio, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterExit')
                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeExit', {
                      sender: from,
                      strategy,
                      ratio,
                      data: '0x',
                    })
                  })
                })

                context('when after is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x80')
                  })

                  it('only calls after to the portfolio', async () => {
                    const tx = await vault.exit(portfolio, strategy, ratio, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeExit')
                    await assertIndirectEvent(tx, portfolio.interface, 'AfterExit', {
                      sender: from,
                      strategy,
                      ratio,
                      data: '0x',
                    })
                  })
                })

                context('when both are allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0xC0')
                  })

                  it('calls before and after to the portfolio', async () => {
                    const tx = await vault.exit(portfolio, strategy, ratio, { from })

                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeExit', {
                      sender: from,
                      strategy,
                      ratio,
                      data: '0x',
                    })

                    await assertIndirectEvent(tx, portfolio.interface, 'AfterExit', {
                      sender: from,
                      strategy,
                      ratio,
                      data: '0x',
                    })
                  })
                })
              })
            })

            context('when the user is even', async () => {
              const rate = fp(1)
              itExitsAsExpected(rate)
            })

            context('when the user losses', async () => {
              const rate = fp(1.05)
              itExitsAsExpected(rate)
            })
          })

          context('when the given ratio is not valid', async () => {
            const ratio = fp(10)

            it('reverts', async () => {
              await expect(vault.exit(portfolio, strategy, ratio, { from })).to.be.revertedWith('INVALID_EXIT_RATIO')
            })
          })
        })

        context('when the portfolio does not have enough shares', async () => {
          it('reverts', async () => {
            await expect(vault.exit(portfolio, strategy, fp(1), { from })).to.be.revertedWith('EXIT_SHARES_ZERO')
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.exit(portfolio, strategy, fp(1), { from })).to.be.revertedWith('SENDER_NOT_ALLOWED')
        })
      })
    })
  })

  describe('batch', () => {
    let strategy: Contract, token: Token, from: SignerWithAddress

    beforeEach('deploy strategy', async () => {
      token = tokens.first
      strategy = await deploy('StrategyMock', [token.address])
    })

    beforeEach('mock can perform', async () => {
      from = other
      await portfolio.mockCanPerform(true)
    })

    it('allows batching actions', async () => {
      const amount = fp(500)
      const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
      const expectedFee = depositedAmount.sub(amount)
      await token.mint(portfolio, depositedAmount)
      await portfolio.mockApproveTokens(tokens.addresses, depositedAmount)

      const deposit = await vault.instance.populateTransaction.deposit(portfolio.address, [token.address], [depositedAmount])
      const join = await vault.instance.populateTransaction.join(portfolio.address, strategy.address, amount, '0x')
      const exit = await vault.instance.populateTransaction.exit(portfolio.address, strategy.address, fp(0.5), '0x')
      const tx = await vault.instance.connect(from).batch([deposit, join, exit].map((tx) => tx.data))

      await assertEvent(tx, 'Deposit', {
        account: portfolio,
        tokens: [token.address],
        amounts: [depositedAmount],
        depositFees: [expectedFee],
        caller: from,
      })

      await assertEvent(tx, 'Join', {
        account: portfolio,
        strategy,
        amount,
        shares: amount,
        caller: from,
      })

      await assertEvent(tx, 'Exit', {
        account: portfolio,
        strategy,
        amountInvested: amount.div(2),
        amountReceived: amount.div(2),
        shares: amount.div(2),
        protocolFee: 0,
        performanceFee: 0,
        caller: from,
      })
    })
  })

  describe('set protocol fee', () => {
    let from: SignerWithAddress

    context('when the sender is the admin', () => {
      beforeEach('set sender', async () => {
        from = admin
      })

      context('when the new protocol fee is below the max', () => {
        const newProtocolFee = fp(0.0004)

        it('updates the protocol fee', async () => {
          await vault.setProtocolFee(newProtocolFee, { from })

          expect(await vault.getProtocolFee()).to.be.equal(newProtocolFee)
        })

        it('emits an event', async () => {
          const tx = await vault.setProtocolFee(newProtocolFee, { from })

          await assertEvent(tx, 'ProtocolFeeSet', { protocolFee: newProtocolFee })
        })
      })

      context('when the new protocol fee is above the max', () => {
        const newProtocolFee = fp(0.0005).add(1)

        it('reverts', async () => {
          await expect(vault.setProtocolFee(newProtocolFee, { from })).to.be.revertedWith('PROTOCOL_FEE_TOO_HIGH')
        })
      })
    })

    context('when the sender is not the admin', () => {
      beforeEach('set sender', async () => {
        from = other
      })

      it('reverts', async () => {
        await expect(vault.setProtocolFee(fp(1), { from })).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('set swap connector', () => {
    let from: SignerWithAddress

    context('when the sender is the admin', () => {
      beforeEach('set sender', async () => {
        from = admin
      })

      context('when the new connector is a contract', () => {
        it('updates the swap connector', async () => {
          const newConnector = await deploy('SwapConnectorMock')

          await vault.setSwapConnector(newConnector, { from })

          expect(await vault.getSwapConnector()).to.be.equal(newConnector.address)
        })

        it('emits an event', async () => {
          const newConnector = await deploy('SwapConnectorMock')

          const tx = await vault.setSwapConnector(newConnector, { from })

          await assertEvent(tx, 'SwapConnectorSet', { swapConnector: newConnector })
        })
      })

      context('when the new connector is not a contract', () => {
        const newConnector = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(vault.setSwapConnector(newConnector, { from })).to.be.revertedWith('SWAP_CONNECTOR_ZERO_ADDRESS')
        })
      })
    })

    context('when the sender is not the admin', () => {
      beforeEach('set sender', async () => {
        from = other
      })

      it('reverts', async () => {
        await expect(vault.setSwapConnector(ZERO_ADDRESS, { from })).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('set whitelisted strategies', () => {
    let from: SignerWithAddress

    context('when the sender is the admin', () => {
      beforeEach('set sender', async () => {
        from = admin
      })

      context('when the any of the strategies is not a contract', () => {
        it('updates the whitelisted strategies', async () => {
          const strategy1 = await deploy('StrategyMock', [tokens.first.address])
          const strategy2 = await deploy('StrategyMock', [tokens.second.address])

          await vault.setWhitelistedStrategies([strategy1, strategy2], [true, false], { from })

          expect(await vault.isStrategyWhitelisted(strategy1)).to.be.true
          expect(await vault.isStrategyWhitelisted(strategy2)).to.be.false
        })

        it('emits an event', async () => {
          const strategy1 = await deploy('StrategyMock', [tokens.first.address])
          const strategy2 = await deploy('StrategyMock', [tokens.second.address])

          const tx = await vault.setWhitelistedStrategies([strategy1, strategy2], [true, false], { from })

          await assertEvent(tx, 'WhitelistedStrategySet', { strategy: strategy1, whitelisted: true })
          await assertEvent(tx, 'WhitelistedStrategySet', { strategy: strategy2, whitelisted: false })
        })
      })

      context('when the strategy is not a contract', () => {
        const strategy = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(vault.setWhitelistedStrategies([strategy], [true], { from })).to.be.revertedWith('STRATEGY_ZERO_ADDRESS')
        })
      })
    })

    context('when the sender is not the admin', () => {
      beforeEach('set sender', async () => {
        from = other
      })

      it('reverts', async () => {
        await expect(vault.setWhitelistedStrategies([], [], { from })).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })
})
