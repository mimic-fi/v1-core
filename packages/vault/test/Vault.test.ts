import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { assertEvent, assertIndirectEvent, assertNoIndirectEvent, BigNumberish, deploy, fp, getSigners, MAX_UINT256, ZERO_ADDRESS } from '@mimic-fi/v1-helpers'

import Vault from './helpers/vault/Vault'
import Token from './helpers/tokens/Token'
import TokenList from './helpers/tokens/TokenList'

describe('Vault', () => {
  let tokens: TokenList, token: Token, vault: Vault, portfolio: Contract
  let account: SignerWithAddress, other: SignerWithAddress, admin: SignerWithAddress, feeCollector: SignerWithAddress

  const depositFee = fp(0.01)
  const withdrawFee = fp(0.02)
  const protocolFee = fp(0.05)
  const performanceFee = fp(0.2)

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [admin, account, other, feeCollector] = await getSigners()
  })

  beforeEach('deploy vault, tokens, and portfolio', async () => {
    vault = await Vault.create({ protocolFee, from: admin })
    tokens = await TokenList.create(2)
    token = tokens.first
    portfolio = await deploy('PortfolioMock', [vault.address, depositFee, withdrawFee, performanceFee, feeCollector.address])
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
            await token.mint(account, amount)
          })

          context('when the sender has approved enough tokens', async () => {
            beforeEach('approve tokens', async () => {
              await token.approve(vault, amount, { from: account })
            })

            it('transfers the tokens to the vault', async () => {
              const previousVaultBalance = await token.balanceOf(vault)
              const previousAccountBalance = await token.balanceOf(account)

              await vault.deposit(account, token, amount, { from })

              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.add(amount))

              const currentAccountBalance = await token.balanceOf(account)
              expect(currentAccountBalance).to.be.equal(previousAccountBalance.sub(amount))
            })

            it('increases the account available balance in the vault', async () => {
              const previousBalance = await vault.getAccountBalance(account, token)

              await vault.deposit(account, token, amount, { from })

              const currentBalance = await vault.getAccountBalance(account, token)
              expect(currentBalance).to.be.equal(previousBalance.add(amount))
            })

            it('emits an event', async () => {
              const tx = await vault.deposit(account, token, amount, { from })

              await assertEvent(tx, 'Deposit', {
                account,
                token,
                amount,
                depositFee: fp(0),
              })
            })

            it('calculates the expected amount', async () => {
              expect(await vault.getDepositAmount(account, amount)).to.be.equal(amount)
            })
          })

          context('when the sender did not approve enough tokens', async () => {
            it('reverts', async () => {
              await expect(vault.deposit(account, token, amount, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
          })
        })

        context('when the sender does not have enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.deposit(account, token, fp(10), { from })).to.be.revertedWith('ERC20: transfer amount exceeds balance')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.deposit(account, token, fp(10), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
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
            await token.mint(portfolio, amount)
          })

          context('when the sender has approved enough tokens', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(token.address, MAX_UINT256)
            })

            it('transfers the tokens to the vault charging deposit fees', async () => {
              const previousVaultBalance = await token.balanceOf(vault)
              const previousPortfolioBalance = await token.balanceOf(portfolio)
              const previousCollectorBalance = await token.balanceOf(feeCollector)

              await vault.deposit(portfolio, token, amount, { from })

              const currentCollectorBalance = await token.balanceOf(feeCollector)
              expect(currentCollectorBalance).to.be.equal(previousCollectorBalance.add(expectedFee))

              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.add(amount).sub(expectedFee))

              const currentPortfolioBalance = await token.balanceOf(portfolio)
              expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance.sub(amount))
            })

            it('increases the account available balance in the vault', async () => {
              const previousBalance = await vault.getAccountBalance(portfolio, token)

              await vault.deposit(portfolio, token, amount, { from })

              const currentBalance = await vault.getAccountBalance(portfolio, token)
              expect(currentBalance).to.be.equal(previousBalance.add(amount).sub(expectedFee))
            })

            it('emits an event', async () => {
              const tx = await vault.deposit(portfolio, token, amount, { from })

              await assertEvent(tx, 'Deposit', {
                account: portfolio,
                token,
                amount,
                depositFee: expectedFee,
              })
            })

            it('calculates the expected amount', async () => {
              const expectedAmount = amount.sub(expectedFee)
              expect(await vault.getDepositAmount(portfolio, amount)).to.be.equal(expectedAmount)
            })

            describe('authorization', async () => {
              it('encodes the authorization as expected', async () => {
                const how = vault.encodeDeposit(token, amount)
                await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('deposit'), how })

                await expect(vault.deposit(portfolio, token, amount, { from })).not.to.be.reverted
              })

              it('fails with an invalid authorization', async () => {
                await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('deposit'), how: '0x' })

                await expect(vault.deposit(portfolio, token, amount, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
              })
            })

            describe('callbacks', async () => {
              context('when non is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0000')
                })

                it('does not call the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, token, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeDeposit')
                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterDeposit')
                })
              })

              context('when before is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0001')
                })

                it('only calls before to the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, token, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterDeposit')
                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeDeposit', {
                    sender: from,
                    token,
                    amount,
                  })
                })
              })

              context('when after is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0002')
                })

                it('only calls after to the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, token, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeDeposit')
                  await assertIndirectEvent(tx, portfolio.interface, 'AfterDeposit', {
                    sender: from,
                    token,
                    amount,
                  })
                })
              })

              context('when both are allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0003')
                })

                it('calls before and after to the portfolio', async () => {
                  const tx = await vault.deposit(portfolio, token, amount, { from })

                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeDeposit', {
                    sender: from,
                    token,
                    amount,
                  })

                  await assertIndirectEvent(tx, portfolio.interface, 'AfterDeposit', {
                    sender: from,
                    token,
                    amount,
                  })
                })
              })
            })
          })

          context('when the portfolio did not approve enough tokens', async () => {
            it('reverts', async () => {
              await expect(vault.deposit(portfolio, token, amount, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.deposit(portfolio, token, fp(10), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
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
            await token.mint(account, amount)
            await token.approve(vault, amount, { from: account })
            await vault.deposit(account, token, amount, { from: account })
          })

          it('transfers the tokens to the recipient', async () => {
            const previousVaultBalance = await token.balanceOf(vault)
            const previousRecipientBalance = await token.balanceOf(other)

            await vault.withdraw(account, token, amount, other, { from })

            const currentVaultBalance = await token.balanceOf(vault)
            expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

            const currentRecipientBalance = await token.balanceOf(other)
            expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount))
          })

          it('decreases the account available balance in the vault', async () => {
            const previousBalance = await vault.getAccountBalance(account, token)

            await vault.withdraw(account, token, amount, other, { from })

            const currentBalance = await vault.getAccountBalance(account, token)
            expect(currentBalance).to.be.equal(previousBalance.sub(amount))
          })

          it('emits an event', async () => {
            const tx = await vault.withdraw(account, token, amount, other, { from })

            await assertEvent(tx, 'Withdraw', {
              account,
              token,
              amount,
              recipient: other,
            })
          })

          it('calculates the expected amount', async () => {
            expect(await vault.getWithdrawAmount(account, token, amount)).to.be.equal(amount)
          })
        })

        context('when the sender did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.withdraw(account, token, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.withdraw(account, token, amount, other, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
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
            await token.mint(portfolio, amount)
          })

          context('when the portfolio has allowed the corresponding amount', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(token.address, amount)
            })

            it('transfers the tokens to the recipient', async () => {
              const previousVaultBalance = await token.balanceOf(vault)
              const previousPortfolioBalance = await token.balanceOf(portfolio)
              const previousRecipientBalance = await token.balanceOf(other)

              await vault.withdraw(portfolio, token, amount, other, { from })

              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance)

              const currentPortfolioBalance = await token.balanceOf(portfolio)
              expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance.sub(amount))

              const currentRecipientBalance = await token.balanceOf(other)
              expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount))
            })

            it('does not affect the account available balance in the vault', async () => {
              const previousBalance = await vault.getAccountBalance(portfolio, token)

              await vault.withdraw(portfolio, token, amount, other, { from })

              const currentBalance = await vault.getAccountBalance(portfolio, token)
              expect(currentBalance).to.be.equal(previousBalance)
            })

            it('emits an event', async () => {
              const tx = await vault.withdraw(portfolio, token, amount, other, { from })

              await assertEvent(tx, 'Withdraw', {
                account: portfolio,
                token,
                amount,
                fromVault: fp(0),
                recipient: other,
              })
            })

            describe('authorization', async () => {
              it('encodes the authorization as expected', async () => {
                const how = vault.encodeWithdraw(token, amount, other)
                await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('withdraw'), how })

                await expect(vault.withdraw(portfolio, token, amount, other, { from })).not.to.be.reverted
              })

              it('fails with an invalid authorization', async () => {
                await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('withdraw'), how: '0x' })

                await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
              })
            })

            describe('callbacks', async () => {
              context('when non is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0000')
                })

                it('does not call the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, token, amount, other, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw')
                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterWithdraw')
                })
              })

              context('when before is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0004')
                })

                it('only calls before to the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, token, amount, other, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterWithdraw')
                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw', {
                    sender: from,
                    token,
                    amount,
                    recipient: other,
                  })
                })
              })

              context('when after is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0008')
                })

                it('only calls after to the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, token, amount, other, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw')
                  await assertIndirectEvent(tx, portfolio.interface, 'AfterWithdraw', {
                    sender: from,
                    token,
                    amount,
                    recipient: other,
                  })
                })
              })

              context('when both are allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x000C')
                })

                it('calls before and after to the portfolio', async () => {
                  const tx = await vault.withdraw(portfolio, token, amount, other, { from })

                  await assertIndirectEvent(tx, portfolio.interface, 'BeforeWithdraw', {
                    sender: from,
                    token,
                    amount,
                    recipient: other,
                  })

                  await assertIndirectEvent(tx, portfolio.interface, 'AfterWithdraw', {
                    sender: from,
                    token,
                    amount,
                    recipient: other,
                  })
                })
              })
            })
          })

          context('when the portfolio did not allow the corresponding amount', async () => {
            it('reverts', async () => {
              await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
            })
          })
        })

        context('when the portfolio does not have enough balance', async () => {
          beforeEach('mint tokens', async () => {
            await token.mint(portfolio, amount.div(2))
          })

          context('when the portfolio has allowed the corresponding amount', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(token.address, MAX_UINT256)
            })

            context('when there are enough tokens deposited in the vault', async () => {
              const expectedWithdrawFee = amount.div(2).mul(withdrawFee).div(fp(1))

              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await token.mint(portfolio, depositedAmount)
                await vault.deposit(portfolio, token, depositedAmount, { from })
              })

              it('transfers the tokens to the recipient', async () => {
                const previousVaultBalance = await token.balanceOf(vault)
                const previousPortfolioBalance = await token.balanceOf(portfolio)
                const previousRecipientBalance = await token.balanceOf(other)
                const previousCollectorBalance = await token.balanceOf(feeCollector)

                await vault.withdraw(portfolio, token, amount, other, { from })

                const currentVaultBalance = await token.balanceOf(vault)
                expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount.div(2)))

                const currentPortfolioBalance = await token.balanceOf(portfolio)
                expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance.sub(amount.div(2)))

                const currentRecipientBalance = await token.balanceOf(other)
                expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount.sub(expectedWithdrawFee)))

                const currentCollectorBalance = await token.balanceOf(feeCollector)
                expect(currentCollectorBalance).to.be.equal(previousCollectorBalance.add(expectedWithdrawFee))
              })

              it('decreases the account available balance in the vault', async () => {
                const previousBalance = await vault.getAccountBalance(portfolio, token)

                await vault.withdraw(portfolio, token, amount, other, { from })

                const currentBalance = await vault.getAccountBalance(portfolio, token)
                expect(currentBalance).to.be.equal(previousBalance.sub(amount.div(2)))
              })

              it('emits an event', async () => {
                const tx = await vault.withdraw(portfolio, token, amount, other, { from })

                await assertEvent(tx, 'Withdraw', {
                  account: portfolio,
                  token,
                  amount,
                  fromVault: amount.div(2),
                  withdrawFee: expectedWithdrawFee,
                  recipient: other,
                })
              })
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })

          context('when the portfolio did not allow the corresponding amount', async () => {
            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await portfolio.mockApproveTokens(token.address, depositedAmount)
                await token.mint(portfolio, depositedAmount)
                await vault.deposit(portfolio, token, depositedAmount, { from })
              })

              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ERC20: transfer amount exceeds allowance')
              })
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })
        })

        context('when the portfolio does not have balance at all', async () => {
          const itWithdrawsTokensFromVault = () => {
            const expectedWithdrawFee = amount.mul(withdrawFee).div(fp(1))

            it('transfers the tokens to the recipient', async () => {
              const previousVaultBalance = await token.balanceOf(vault)
              const previousPortfolioBalance = await token.balanceOf(portfolio)
              const previousRecipientBalance = await token.balanceOf(other)
              const previousCollectorBalance = await token.balanceOf(feeCollector)

              await vault.withdraw(portfolio, token, amount, other, { from })

              const currentVaultBalance = await token.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

              const currentPortfolioBalance = await token.balanceOf(portfolio)
              expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

              const currentRecipientBalance = await token.balanceOf(other)
              expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amount).sub(expectedWithdrawFee))

              const currentCollectorBalance = await token.balanceOf(feeCollector)
              expect(currentCollectorBalance).to.be.equal(previousCollectorBalance.add(expectedWithdrawFee))
            })

            it('decreases the account available balance in the vault', async () => {
              const previousBalance = await vault.getAccountBalance(portfolio, token)

              await vault.withdraw(portfolio, token, amount, other, { from })

              const currentBalance = await vault.getAccountBalance(portfolio, token)
              expect(currentBalance).to.be.equal(previousBalance.sub(amount))
            })

            it('emits an event', async () => {
              const tx = await vault.withdraw(portfolio, token, amount, other, { from })

              await assertEvent(tx, 'Withdraw', {
                account: portfolio,
                token,
                amount,
                fromVault: amount,
                withdrawFee: expectedWithdrawFee,
                recipient: other,
              })
            })

            it('calculates the expected amount', async () => {
              const expectedAmount = amount.sub(expectedWithdrawFee)
              expect(await vault.getWithdrawAmount(portfolio, token, amount)).to.be.equal(expectedAmount)
            })
          }

          context('when the portfolio has allowed the vault', async () => {
            beforeEach('approve tokens', async () => {
              await portfolio.mockApproveTokens(token.address, MAX_UINT256)
            })

            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await token.mint(portfolio, depositedAmount)
                await vault.deposit(portfolio, token, depositedAmount, { from })
              })

              itWithdrawsTokensFromVault()
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
              })
            })
          })

          context('when the portfolio did not allow the vault', async () => {
            context('when there are enough tokens deposited in the vault', async () => {
              beforeEach('deposit tokens', async () => {
                const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
                await token.mint(portfolio, depositedAmount)
                await portfolio.mockApproveTokens(token.address, depositedAmount)
                await vault.deposit(portfolio, token, depositedAmount, { from })
              })

              itWithdrawsTokensFromVault()
            })

            context('when there are not enough tokens deposited in the vault', async () => {
              it('reverts', async () => {
                await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
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
          await expect(vault.withdraw(portfolio, token, amount, other, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
        })
      })
    })
  })

  describe('swap', () => {
    let tokenIn: Token, tokenOut: Token, priceOracle: Contract, swapConnector: Contract

    const amount = fp(500)
    const ORACLE_RATE = fp(0.98)

    beforeEach('deploy strategy', async () => {
      tokenIn = tokens.first
      tokenOut = tokens.second
    })

    beforeEach('mock price oracle rate', async () => {
      priceOracle = vault.priceOracle
      swapConnector = vault.swapConnector
      await priceOracle.mockRate(ORACLE_RATE)
    })

    context('when the account is an EOA', () => {
      context('when the sender is the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = account
        })

        context('when the sender has deposited enough tokens', async () => {
          beforeEach('deposit tokens', async () => {
            await tokenIn.mint(account, amount)
            await tokenIn.approve(vault, amount, { from: account })
            await vault.deposit(account, tokenIn, amount, { from: account })
          })

          const itSwapsAsExpected = (rate: BigNumberish, slippage: BigNumberish) => {
            const expectedAmountOut = amount.mul(rate).div(fp(1))

            beforeEach('fund swap connector', async () => {
              await tokenOut.mint(swapConnector, expectedAmountOut)
            })

            it('transfers the token in to the swap connector', async () => {
              const previousVaultBalance = await tokenIn.balanceOf(vault)
              const previousAccountBalance = await tokenIn.balanceOf(account)
              const previousConnectorBalance = await tokenIn.balanceOf(swapConnector)

              await vault.swap(account, tokenIn, tokenOut, amount, slippage, { from })

              const currentVaultBalance = await tokenIn.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

              const currentAccountBalance = await tokenIn.balanceOf(account)
              expect(currentAccountBalance).to.be.equal(previousAccountBalance)

              const currentConnectorBalance = await tokenIn.balanceOf(swapConnector)
              expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.add(amount))
            })

            it('transfers the token out to the vault account', async () => {
              const previousVaultBalance = await tokenOut.balanceOf(vault)
              const previousAccountBalance = await tokenOut.balanceOf(account)
              const previousConnectorBalance = await tokenOut.balanceOf(swapConnector)

              await vault.swap(account, tokenIn, tokenOut, amount, slippage, { from })

              const currentVaultBalance = await tokenOut.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.add(expectedAmountOut))

              const currentAccountBalance = await tokenOut.balanceOf(account)
              expect(currentAccountBalance).to.be.equal(previousAccountBalance)

              const currentConnectorBalance = await tokenOut.balanceOf(swapConnector)
              expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.sub(expectedAmountOut))
            })

            it('updates the account available balance in the vault', async () => {
              const previousTokenInBalance = await vault.getAccountBalance(account, tokenIn)
              const previousTokenOutBalance = await vault.getAccountBalance(account, tokenOut)

              await vault.swap(account, tokenIn, tokenOut, amount, slippage, { from })

              const currentTokenInBalance = await vault.getAccountBalance(account, tokenIn)
              expect(currentTokenInBalance).to.be.equal(previousTokenInBalance.sub(amount))

              const currentTokenOutBalance = await vault.getAccountBalance(account, tokenOut)
              expect(currentTokenOutBalance).to.be.equal(previousTokenOutBalance.add(expectedAmountOut))
            })

            it('emits an events', async () => {
              const tx = await vault.swap(account, tokenIn, tokenOut, amount, slippage, { from })

              await assertEvent(tx, 'Swap', {
                account,
                tokenIn,
                tokenOut,
                amountIn: amount,
                remainingIn: 0,
                amountOut: expectedAmountOut,
              })
            })

            it('calculates the expected amount', async () => {
              expect(await vault.getSwapAmount(tokenIn, tokenOut, amount)).to.be.equal(expectedAmountOut)
            })
          }

          context('when the swap connector provides a worse rate', () => {
            const connectorSlippage = fp(0.01)
            const SWAP_RATE = ORACLE_RATE.mul(fp(1).sub(connectorSlippage)).div(fp(1))

            beforeEach('mock swap connector rate', async () => {
              await swapConnector.mockRate(SWAP_RATE)
            })

            context('when the user accepts that slippage', () => {
              const slippage = connectorSlippage

              itSwapsAsExpected(SWAP_RATE, slippage)
            })

            context('when the user does not accept that slippage', () => {
              const slippage = connectorSlippage.sub(1)

              it('reverts', async () => {
                await expect(vault.swap(account, tokenIn, tokenOut, amount, slippage, { from })).to.be.revertedWith('SWAP_MIN_AMOUNT')
              })
            })
          })

          context('when the swap connector provides the same rate', () => {
            const SWAP_RATE = ORACLE_RATE

            beforeEach('mock swap connector rate', async () => {
              await swapConnector.mockRate(SWAP_RATE)
            })

            context('when the user accepts no slippage', () => {
              const slippage = 0

              itSwapsAsExpected(SWAP_RATE, slippage)
            })

            context('when the user accepts a higher slippage', () => {
              const slippage = fp(0.2)

              itSwapsAsExpected(SWAP_RATE, slippage)
            })
          })

          context('when the swap connector provides a better rate', () => {
            const SWAP_RATE = ORACLE_RATE.add(fp(0.01))

            beforeEach('mock swap connector rate', async () => {
              await swapConnector.mockRate(SWAP_RATE)
            })

            context('when the user accepts no slippage', () => {
              const slippage = 0

              itSwapsAsExpected(SWAP_RATE, slippage)
            })

            context('when the user accepts a higher slippage', () => {
              const slippage = fp(0.2)

              itSwapsAsExpected(SWAP_RATE, slippage)
            })
          })
        })

        context('when the sender did not deposit enough tokens', () => {
          it('reverts', async () => {
            await expect(vault.swap(account, tokenIn, tokenOut, amount, 0, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not the EOA', () => {
        let from: SignerWithAddress

        beforeEach('set sender', async () => {
          from = other
        })

        it('reverts', async () => {
          await expect(vault.swap(account, tokenIn, tokenOut, amount, 0, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
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
          beforeEach('deposit tokens', async () => {
            const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
            await tokenIn.mint(portfolio, depositedAmount)
            await portfolio.mockApproveTokens(tokenIn.address, depositedAmount)
            await vault.deposit(portfolio, tokenIn, depositedAmount, { from })
          })

          const itSwapsAsExpected = (rate: BigNumberish, slippage: BigNumberish) => {
            const expectedAmountOut = amount.mul(rate).div(fp(1))

            beforeEach('fund swap connector', async () => {
              await tokenOut.mint(swapConnector, expectedAmountOut)
            })

            it('transfers the token in to the swap connector', async () => {
              const previousVaultBalance = await tokenIn.balanceOf(vault)
              const previousPortfolioBalance = await tokenIn.balanceOf(portfolio)
              const previousConnectorBalance = await tokenIn.balanceOf(swapConnector)

              await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

              const currentVaultBalance = await tokenIn.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.sub(amount))

              const currentPortfolioBalance = await tokenIn.balanceOf(portfolio)
              expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

              const currentConnectorBalance = await tokenIn.balanceOf(swapConnector)
              expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.add(amount))
            })

            it('transfers the token out to the vault', async () => {
              const previousVaultBalance = await tokenOut.balanceOf(vault)
              const previousPortfolioBalance = await tokenOut.balanceOf(portfolio)
              const previousConnectorBalance = await tokenOut.balanceOf(swapConnector)

              await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

              const currentVaultBalance = await tokenOut.balanceOf(vault)
              expect(currentVaultBalance).to.be.equal(previousVaultBalance.add(expectedAmountOut))

              const currentPortfolioBalance = await tokenOut.balanceOf(portfolio)
              expect(currentPortfolioBalance).to.be.equal(previousPortfolioBalance)

              const currentConnectorBalance = await tokenOut.balanceOf(swapConnector)
              expect(currentConnectorBalance).to.be.equal(previousConnectorBalance.sub(expectedAmountOut))
            })

            it('decreases the portfolio available balance of the joining token in the vault', async () => {
              const previousTokenInBalance = await vault.getAccountBalance(portfolio, tokenIn)
              const previousTokenOutBalance = await vault.getAccountBalance(portfolio, tokenOut)

              await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

              const currentTokenInBalance = await vault.getAccountBalance(portfolio, tokenIn)
              expect(currentTokenInBalance).to.be.equal(previousTokenInBalance.sub(amount))

              const currentTokenOutBalance = await vault.getAccountBalance(portfolio, tokenOut)
              expect(currentTokenOutBalance).to.be.equal(previousTokenOutBalance.add(expectedAmountOut))
            })

            it('emits an events', async () => {
              const tx = await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

              await assertEvent(tx, 'Swap', {
                account: portfolio,
                tokenIn,
                tokenOut,
                amountIn: amount,
                remainingIn: 0,
                amountOut: expectedAmountOut,
              })
            })

            it('calculates the expected amount', async () => {
              expect(await vault.getSwapAmount(tokenIn, tokenOut, amount)).to.be.equal(expectedAmountOut)
            })
          }

          context('when the swap connector provides a worse rate', () => {
            const connectorSlippage = fp(0.01)
            const SWAP_RATE = ORACLE_RATE.mul(fp(1).sub(connectorSlippage)).div(fp(1))

            beforeEach('mock swap connector rate', async () => {
              await swapConnector.mockRate(SWAP_RATE)
            })

            context('when the user accepts that slippage', () => {
              const slippage = connectorSlippage

              itSwapsAsExpected(SWAP_RATE, slippage)
            })

            context('when the user does not accept that slippage', () => {
              const slippage = connectorSlippage.sub(1)

              it('reverts', async () => {
                await expect(vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })).to.be.revertedWith('SWAP_MIN_AMOUNT')
              })
            })
          })

          context('when the swap connector provides the same rate', () => {
            const SWAP_RATE = ORACLE_RATE

            beforeEach('mock swap connector rate', async () => {
              await swapConnector.mockRate(SWAP_RATE)
            })

            context('when the user accepts no slippage', () => {
              const slippage = 0

              itSwapsAsExpected(SWAP_RATE, slippage)
            })

            context('when the user accepts a higher slippage', () => {
              const slippage = fp(0.2)

              itSwapsAsExpected(SWAP_RATE, slippage)
            })
          })

          context('when the swap connector provides a better rate', () => {
            const SWAP_RATE = ORACLE_RATE.add(1)

            beforeEach('mock swap connector rate', async () => {
              await swapConnector.mockRate(SWAP_RATE)
            })

            context('when the user accepts no slippage', () => {
              const slippage = 0

              itSwapsAsExpected(SWAP_RATE, slippage)
            })

            context('when the user accepts a higher slippage', () => {
              const slippage = fp(0.2)

              itSwapsAsExpected(SWAP_RATE, slippage)

              describe('authorization', async () => {
                it('encodes the authorization as expected', async () => {
                  const how = vault.encodeSwap(tokenIn, tokenOut, amount, slippage, '0xaa')
                  await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('swap'), how })

                  await expect(vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, '0xaa', { from })).not.to.be.reverted
                })

                it('fails with an invalid authorization', async () => {
                  await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('swap'), how: '0x' })

                  await expect(vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
                })
              })

              describe('callbacks', async () => {
                const slippage = fp(0.2)

                context('when non is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x0000')
                  })

                  it('does not call the portfolio', async () => {
                    const tx = await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeSwap')
                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterSwap')
                  })
                })

                context('when before is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x0010')
                  })

                  it('only calls before to the portfolio', async () => {
                    const tx = await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterSwap')
                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeSwap', {
                      sender: from,
                      tokenIn,
                      tokenOut,
                      amountIn: amount,
                      slippage,
                      data: '0x',
                    })
                  })
                })

                context('when after is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x0020')
                  })

                  it('only calls after to the portfolio', async () => {
                    const tx = await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeSwap')
                    await assertIndirectEvent(tx, portfolio.interface, 'AfterSwap', {
                      sender: from,
                      tokenIn,
                      tokenOut,
                      amountIn: amount,
                      slippage,
                      data: '0x',
                    })
                  })
                })

                context('when both are allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x0030')
                  })

                  it('calls before and after to the portfolio', async () => {
                    const tx = await vault.swap(portfolio, tokenIn, tokenOut, amount, slippage, { from })

                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeSwap', {
                      sender: from,
                      tokenIn,
                      tokenOut,
                      amountIn: amount,
                      slippage,
                      data: '0x',
                    })

                    await assertIndirectEvent(tx, portfolio.interface, 'AfterSwap', {
                      sender: from,
                      tokenIn,
                      tokenOut,
                      amountIn: amount,
                      slippage,
                      data: '0x',
                    })
                  })
                })
              })
            })
          })
        })

        context('when the portfolio did not deposit enough tokens', async () => {
          it('reverts', async () => {
            await expect(vault.swap(portfolio, tokenIn, tokenOut, amount, 0, { from })).to.be.revertedWith('ACCOUNTING_INSUFFICIENT_BALANCE')
          })
        })
      })

      context('when the sender is not allowed', () => {
        beforeEach('mock can perform', async () => {
          await portfolio.mockCanPerform(false)
        })

        it('reverts', async () => {
          await expect(vault.swap(portfolio, tokenIn, tokenOut, amount, fp(1), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
        })
      })
    })
  })

  describe('join', () => {
    let strategy: Contract

    beforeEach('deploy strategy', async () => {
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
            const expectedShares = amount.mul(fp(1)).div(rate)

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
              })
            })

            it('calculates the expected amount', async () => {
              expect(await vault.getJoinAmount(strategy, amount)).to.be.equal(expectedShares)
            })
          }

          context('with a rate lower than one', async () => {
            const rate = fp(0.95)
            itJoinsAsExpected(rate)
          })

          context('with a rate equal to one', async () => {
            const rate = fp(1)
            itJoinsAsExpected(rate)
          })

          context('with a rate higher to one', async () => {
            const rate = fp(1.05)
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
          await expect(vault.join(account, strategy, fp(10), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
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
            await portfolio.mockApproveTokens(token.address, depositedAmount)
            await vault.deposit(portfolio, token, depositedAmount, { from })
          })

          const itJoinsAsExpected = (rate: BigNumberish) => {
            const expectedShares = amount.mul(fp(1)).div(rate)

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
              })
            })

            it('calculates the expected amount', async () => {
              expect(await vault.getJoinAmount(strategy, amount)).to.be.equal(expectedShares)
            })
          }

          context('with a rate lower than one', async () => {
            const rate = fp(0.95)

            itJoinsAsExpected(rate)

            describe('authorization', async () => {
              it('encodes the authorization as expected', async () => {
                const how = vault.encodeJoin(strategy, amount, '0xaa')
                await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('join'), how })

                await expect(vault.join(portfolio, strategy, amount, '0xaa', { from })).not.to.be.reverted
              })

              it('fails with an invalid authorization', async () => {
                await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('join'), how: '0x' })

                await expect(vault.join(portfolio, strategy, amount, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
              })
            })

            describe('callbacks', async () => {
              context('when non is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0000')
                })

                it('does not call the portfolio', async () => {
                  const tx = await vault.join(portfolio, strategy, amount, { from })

                  await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeJoin')
                  await assertNoIndirectEvent(tx, portfolio.interface, 'AfterJoin')
                })
              })

              context('when before is allowed', () => {
                beforeEach('mock supported callbacks', async () => {
                  await portfolio.mockSupportedCallbacks('0x0040')
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
                  await portfolio.mockSupportedCallbacks('0x0080')
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
                  await portfolio.mockSupportedCallbacks('0x00C0')
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
            const rate = fp(1.05)
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
          await expect(vault.join(portfolio, strategy, fp(10), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
        })
      })
    })
  })

  describe('exit', () => {
    let strategy: Contract

    beforeEach('deploy strategy', async () => {
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
              const expectedAmount = shares.mul(rate).div(fp(1))
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
                })
              })

              it('calculates the expected amount', async () => {
                const exitAmount = gains.gt(0) ? expectedAmountAfterFees : expectedAmount
                expect(await vault.getExitAmount(account, strategy, ratio)).to.be.equal(exitAmount)
              })
            }

            context('when the user gain sth', async () => {
              const rate = fp(1.05)

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
              const rate = fp(0.95)
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
          await expect(vault.exit(account, strategy, fp(1), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
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
            await portfolio.mockApproveTokens(token.address, depositedAmount)
            await vault.deposit(portfolio, token, depositedAmount, { from })
            await vault.join(portfolio, strategy, amount, { from })
          })

          context('when the given ratio is valid', async () => {
            const ratio = fp(1)

            const itExitsAsExpected = (rate: BigNumber) => {
              const expectedAmount = shares.mul(rate).div(fp(1))
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
                  const expectedCollectorBalance = previousCollectorBalance.add(expectedPerformanceFee)
                  expect(currentCollectorBalance).to.be.at.least(expectedCollectorBalance.sub(1))
                  expect(currentCollectorBalance).to.be.at.most(expectedCollectorBalance.add(1))
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
                })
              })

              it('calculates the expected amount', async () => {
                const exitAmount = gains.gt(0) ? expectedAmountAfterFees : expectedAmount
                expect(await vault.getExitAmount(portfolio, strategy, ratio)).to.be.equal(exitAmount)
              })
            }

            context('when the user gain sth', async () => {
              const rate = fp(1.05)

              beforeEach('fund strategy with gains', async () => {
                await token.mint(strategy, shares)
              })

              itExitsAsExpected(rate)

              describe('authorization', async () => {
                it('encodes the authorization as expected', async () => {
                  const how = vault.encodeExit(strategy, ratio, true, '0xaa')
                  await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('exit'), how })

                  await expect(vault.exit(portfolio, strategy, ratio, true, '0xaa', { from })).not.to.be.reverted
                })

                it('fails with an invalid authorization', async () => {
                  await portfolio.mockCanPerformData({ who: from.address, where: vault.address, what: vault.getSelector('exit'), how: '0x' })

                  await expect(vault.exit(portfolio, strategy, ratio, { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
                })
              })

              describe('callbacks', async () => {
                context('when non is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x0000')
                  })

                  it('does not call the portfolio', async () => {
                    const tx = await vault.exit(portfolio, strategy, ratio, { from })

                    await assertNoIndirectEvent(tx, portfolio.interface, 'BeforeExit')
                    await assertNoIndirectEvent(tx, portfolio.interface, 'AfterExit')
                  })
                })

                context('when before is allowed', () => {
                  beforeEach('mock supported callbacks', async () => {
                    await portfolio.mockSupportedCallbacks('0x0100')
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
                    await portfolio.mockSupportedCallbacks('0x0200')
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
                    await portfolio.mockSupportedCallbacks('0x0300')
                  })

                  it('calls before and after to the portfolio', async () => {
                    const tx = await vault.exit(portfolio, strategy, ratio, true, '0xaa', { from })

                    await assertIndirectEvent(tx, portfolio.interface, 'BeforeExit', {
                      sender: from,
                      strategy,
                      ratio,
                      emergency: true,
                      data: '0xaa',
                    })

                    await assertIndirectEvent(tx, portfolio.interface, 'AfterExit', {
                      sender: from,
                      strategy,
                      ratio,
                      emergency: true,
                      data: '0xaa',
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
              const rate = fp(0.95)
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
          await expect(vault.exit(portfolio, strategy, fp(1), { from })).to.be.revertedWith('ACTION_NOT_ALLOWED')
        })
      })
    })
  })

  describe('batch', () => {
    let strategy: Contract, from: SignerWithAddress

    beforeEach('deploy strategy', async () => {
      strategy = await deploy('StrategyMock', [token.address])
    })

    beforeEach('mock can perform', async () => {
      from = other
      await portfolio.mockCanPerform(true)
    })

    context('without reading output', () => {
      it('allows batching actions', async () => {
        const amount = fp(500)
        const depositedAmount = amount.mul(fp(1)).div(fp(1).sub(depositFee))
        const expectedFee = depositedAmount.sub(amount)
        await token.mint(portfolio, depositedAmount)
        await portfolio.mockApproveTokens(token.address, depositedAmount)

        const { data: deposit } = await vault.instance.populateTransaction.deposit(portfolio.address, token.address, depositedAmount)
        const { data: join } = await vault.instance.populateTransaction.join(portfolio.address, strategy.address, amount, '0x')
        const { data: exit } = await vault.instance.populateTransaction.exit(portfolio.address, strategy.address, fp(0.5), false, '0x')

        const tx = await vault.instance.connect(from).batch([deposit, join, exit], [])

        await assertEvent(tx, 'Deposit', {
          account: portfolio,
          token,
          amount: depositedAmount,
          depositFee: expectedFee,
        })

        await assertEvent(tx, 'Join', {
          account: portfolio,
          strategy,
          amount,
          shares: amount,
        })

        await assertEvent(tx, 'Exit', {
          account: portfolio,
          strategy,
          amountInvested: amount.div(2),
          amountReceived: amount.div(2),
          shares: amount.div(2),
          protocolFee: 0,
          performanceFee: 0,
        })
      })
    })

    context('when reading output', () => {
      context('when reading from a deposit', () => {
        let deposit: string

        const readsOutput = [false, true]
        const depositedAmount = fp(500)
        const expectedDepositFee = depositedAmount.mul(depositFee).div(fp(1))

        beforeEach('populate deposit', async () => {
          await tokens.first.mint(portfolio, depositedAmount)
          await portfolio.mockApproveTokens(token.address, depositedAmount)
          const tx = await vault.instance.populateTransaction.deposit(portfolio.address, token.address, depositedAmount)
          deposit = tx.data || ''
        })

        context('when appending it to a swap', () => {
          let tokenIn: Token, tokenOut: Token, swap: string

          const swapRate = fp(1.05)

          beforeEach('populate swap', async () => {
            tokenIn = tokens.first
            tokenOut = tokens.second
            await vault.swapConnector.mockRate(swapRate)
            await tokenOut.mint(vault.swapConnector.address, fp(10000))
            const tx = await vault.instance.populateTransaction.swap(portfolio.address, tokenIn.address, tokenOut.address, MAX_UINT256, fp(0.1), '0xaa')
            swap = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, swap], readsOutput)

            const expectedAmountIn = depositedAmount.sub(expectedDepositFee)
            const expectedAmountOut = expectedAmountIn.mul(swapRate).div(fp(1))

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
              amount: depositedAmount,
              depositFee: expectedDepositFee,
            })

            await assertEvent(tx, 'Swap', {
              account: portfolio,
              tokenIn,
              tokenOut,
              amountIn: expectedAmountIn,
              remainingIn: 0,
              amountOut: expectedAmountOut,
            })
          })
        })

        context('when appending it to a join', () => {
          let join: string

          const strategyRate = fp(0.95)

          beforeEach('populate swap', async () => {
            await strategy.mockRate(strategyRate)
            const tx = await vault.instance.populateTransaction.join(portfolio.address, strategy.address, MAX_UINT256, '0x99')
            join = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, join], readsOutput)

            const expectedJoinAmount = depositedAmount.sub(expectedDepositFee)
            const expectedShares = expectedJoinAmount.mul(fp(1)).div(strategyRate)

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
              amount: depositedAmount,
              depositFee: expectedDepositFee,
            })

            await assertEvent(tx, 'Join', {
              account: portfolio,
              strategy,
              amount: expectedJoinAmount,
              shares: expectedShares,
            })
          })
        })

        context('when appending it to a withdraw', () => {
          let withdraw: string

          beforeEach('populate withdraw', async () => {
            const tx = await vault.instance.populateTransaction.withdraw(portfolio.address, token.address, MAX_UINT256, other.address)
            withdraw = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, withdraw], readsOutput)

            const expectedDepositFee = depositedAmount.mul(depositFee).div(fp(1))
            const expectedWithdrawnAmount = depositedAmount.sub(expectedDepositFee)

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
              amount: depositedAmount,
              depositFee: expectedDepositFee,
            })

            await assertEvent(tx, 'Withdraw', {
              account: portfolio,
              token,
              amount: expectedWithdrawnAmount,
              recipient: other,
            })
          })
        })
      })

      context('when reading from a swap', () => {
        let tokenIn: Token, tokenOut: Token, swap: string, deposit: string

        const readsOutput = [false, false, true]
        const amountIn = fp(100)
        const swapRate = fp(1.05)
        const expectedAmountOut = amountIn.mul(swapRate).div(fp(1))

        beforeEach('populate deposit', async () => {
          await token.mint(portfolio, fp(10000))
          await portfolio.mockApproveTokens(token.address, fp(10000))
          const tx = await vault.instance.populateTransaction.deposit(portfolio.address, token.address, fp(10000))
          deposit = tx.data || ''
        })

        beforeEach('populate swap', async () => {
          tokenIn = tokens.first
          tokenOut = tokens.second
          await vault.swapConnector.mockRate(swapRate)
          await tokenOut.mint(vault.swapConnector.address, fp(10000))
          const tx = await vault.instance.populateTransaction.swap(portfolio.address, tokenIn.address, tokenOut.address, amountIn, fp(0.1), '0xaa')
          swap = tx.data || ''
        })

        context('when appending it to a swap', () => {
          let secondTokenIn: Token, secondTokenOut: Token, secondSwap: string

          beforeEach('populate second swap', async () => {
            secondTokenIn = tokenOut
            secondTokenOut = await Token.create('MKR')
            await secondTokenOut.mint(vault.swapConnector.address, fp(10000))
            const tx = await vault.instance.populateTransaction.swap(portfolio.address, secondTokenIn.address, secondTokenOut.address, MAX_UINT256, fp(0.1), '0xbb')
            secondSwap = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, swap, secondSwap], readsOutput)

            const expectedSecondAmountOut = expectedAmountOut.mul(swapRate).div(fp(1))

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
            })

            await assertEvent(tx, 'Swap', {
              account: portfolio,
              tokenIn,
              tokenOut,
              amountIn,
              amountOut: expectedAmountOut,
              remainingIn: 0,
            })

            await assertEvent(tx, 'Swap', {
              account: portfolio,
              tokenIn: secondTokenIn,
              tokenOut: secondTokenOut,
              amountIn: expectedAmountOut,
              amountOut: expectedSecondAmountOut,
              remainingIn: 0,
            })
          })
        })

        context('when appending it to a join', () => {
          let join: string

          const strategyRate = fp(0.95)

          beforeEach('populate swap', async () => {
            await strategy.mockRate(strategyRate)
            const tx = await vault.instance.populateTransaction.join(portfolio.address, strategy.address, MAX_UINT256, '0x99')
            join = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, swap, join], readsOutput)

            const expectedShares = expectedAmountOut.mul(fp(1)).div(strategyRate).add(1) // rounding error

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
            })

            await assertEvent(tx, 'Swap', {
              account: portfolio,
              tokenIn,
              tokenOut,
              amountIn,
              amountOut: expectedAmountOut,
              remainingIn: 0,
            })

            await assertEvent(tx, 'Join', {
              account: portfolio,
              strategy,
              amount: expectedAmountOut,
              shares: expectedShares,
            })
          })
        })

        context('when appending it to a withdraw', () => {
          let withdraw: string

          beforeEach('populate withdraw', async () => {
            const tx = await vault.instance.populateTransaction.withdraw(portfolio.address, token.address, MAX_UINT256, other.address)
            withdraw = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, swap, withdraw], readsOutput)

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
            })

            await assertEvent(tx, 'Swap', {
              account: portfolio,
              tokenIn,
              tokenOut,
              amountIn,
              amountOut: expectedAmountOut,
              remainingIn: 0,
            })

            await assertEvent(tx, 'Withdraw', {
              account: portfolio,
              token,
              amount: expectedAmountOut,
              recipient: other,
            })
          })
        })
      })

      context('when reading from an exit', () => {
        let deposit: string, join: string, exit: string

        const readsOutput = [false, true, false, true]
        const ratio = fp(0.5)
        const strategyRate = fp(1.05)
        const depositedAmount = fp(10000)
        const expectedDepositFees = depositedAmount.mul(depositFee).div(fp(1))
        const expectedJoinedAmount = depositedAmount.sub(expectedDepositFees)
        const expectedReceivedAmount = expectedJoinedAmount.div(2)

        beforeEach('populate deposit', async () => {
          await token.mint(portfolio, fp(10000))
          await portfolio.mockApproveTokens(token.address, fp(10000))
          const tx = await vault.instance.populateTransaction.deposit(portfolio.address, token.address, fp(10000))
          deposit = tx.data || ''
        })

        beforeEach('populate join', async () => {
          await strategy.mockRate(strategyRate)
          const tx = await vault.instance.populateTransaction.join(portfolio.address, strategy.address, MAX_UINT256, '0x99')
          join = tx.data || ''
        })

        beforeEach('populate exit', async () => {
          const tx = await vault.instance.populateTransaction.exit(portfolio.address, strategy.address, ratio, false, '0xee')
          exit = tx.data || ''
        })

        context('when appending it to a swap', () => {
          let tokenIn: Token, tokenOut: Token, swap: string

          const swapRate = fp(1.02)

          beforeEach('populate second swap', async () => {
            tokenIn = tokens.first
            tokenOut = tokens.second
            await vault.swapConnector.mockRate(swapRate)
            await tokenOut.mint(vault.swapConnector.address, fp(10000))
            const tx = await vault.instance.populateTransaction.swap(portfolio.address, tokenIn.address, tokenOut.address, MAX_UINT256, fp(0.1), '0xaa')
            swap = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, join, exit, swap], readsOutput)

            const expectedAmountOut = expectedReceivedAmount.mul(swapRate).div(fp(1))

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
              depositFee: expectedDepositFees,
            })

            await assertEvent(tx, 'Join', {
              account: portfolio,
              strategy,
              amount: expectedJoinedAmount,
            })

            await assertEvent(tx, 'Exit', {
              account: portfolio,
              strategy,
              amountInvested: expectedJoinedAmount.div(2),
              amountReceived: expectedReceivedAmount,
            })

            await assertEvent(tx, 'Swap', {
              account: portfolio,
              tokenIn,
              tokenOut,
              amountIn: expectedReceivedAmount,
              amountOut: expectedAmountOut,
              remainingIn: 0,
            })
          })
        })

        context('when appending it to a join', () => {
          let secondJoin: string, secondStrategy: Contract

          const secondStrategyRate = fp(0.7)

          beforeEach('populate second join', async () => {
            secondStrategy = await deploy('StrategyMock', [token.address])
            await secondStrategy.mockRate(secondStrategyRate)
            const tx = await vault.instance.populateTransaction.join(portfolio.address, secondStrategy.address, MAX_UINT256, '0x99')
            secondJoin = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, join, exit, secondJoin], readsOutput)

            const expectedShares = expectedReceivedAmount.mul(fp(1)).div(secondStrategyRate) // rounding error

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
              depositFee: expectedDepositFees,
            })

            await assertEvent(tx, 'Join', {
              account: portfolio,
              strategy,
              amount: expectedJoinedAmount,
            })

            await assertEvent(tx, 'Exit', {
              account: portfolio,
              strategy,
              amountInvested: expectedJoinedAmount.div(2),
              amountReceived: expectedReceivedAmount,
            })

            await assertEvent(tx, 'Join', {
              account: portfolio,
              strategy: secondStrategy,
              amount: expectedReceivedAmount,
              shares: expectedShares,
            })
          })
        })

        context('when appending it to a withdraw', () => {
          let withdraw: string

          beforeEach('populate withdraw', async () => {
            const tx = await vault.instance.populateTransaction.withdraw(portfolio.address, token.address, MAX_UINT256, other.address)
            withdraw = tx.data || ''
          })

          it('batches actions correctly', async () => {
            const tx = await vault.instance.connect(from).batch([deposit, join, exit, withdraw], readsOutput)

            await assertEvent(tx, 'Deposit', {
              account: portfolio,
              token,
              depositFee: expectedDepositFees,
            })

            await assertEvent(tx, 'Join', {
              account: portfolio,
              strategy,
              amount: expectedJoinedAmount,
            })

            await assertEvent(tx, 'Exit', {
              account: portfolio,
              strategy,
              amountInvested: expectedJoinedAmount.div(2),
              amountReceived: expectedReceivedAmount,
            })

            await assertEvent(tx, 'Withdraw', {
              account: portfolio,
              token,
              amount: expectedReceivedAmount,
              recipient: other,
            })
          })
        })
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
        const newProtocolFee = fp(0.04)

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
        const newProtocolFee = fp(0.1).add(1)

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

  describe('set price oracle', () => {
    let from: SignerWithAddress

    context('when the sender is the admin', () => {
      beforeEach('set sender', async () => {
        from = admin
      })

      context('when the new oracle is a contract', () => {
        it('updates the price oracle', async () => {
          const newOracle = await deploy('PriceOracleMock')

          await vault.setPriceOracle(newOracle, { from })

          expect(await vault.getPriceOracle()).to.be.equal(newOracle.address)
        })

        it('emits an event', async () => {
          const newOracle = await deploy('PriceOracleMock')

          const tx = await vault.setPriceOracle(newOracle, { from })

          await assertEvent(tx, 'PriceOracleSet', { priceOracle: newOracle })
        })
      })

      context('when the new oracle is not a contract', () => {
        const newOracle = ZERO_ADDRESS

        it('reverts', async () => {
          await expect(vault.setPriceOracle(newOracle, { from })).to.be.revertedWith('PRICE_ORACLE_ZERO_ADDRESS')
        })
      })
    })

    context('when the sender is not the admin', () => {
      beforeEach('set sender', async () => {
        from = other
      })

      it('reverts', async () => {
        await expect(vault.setPriceOracle(ZERO_ADDRESS, { from })).to.be.revertedWith('Ownable: caller is not the owner')
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

  describe('set whitelisted tokens', () => {
    let from: SignerWithAddress

    context('when the sender is the admin', () => {
      beforeEach('set sender', async () => {
        from = admin
      })

      context('when all the tokens are a contract', () => {
        it('updates the whitelisted tokens', async () => {
          await vault.setWhitelistedTokens(tokens, [true, false], { from })

          expect(await vault.isTokenWhitelisted(tokens.first)).to.be.true
          expect(await vault.isTokenWhitelisted(tokens.second)).to.be.false
        })

        it('emits an event for the whitelisted tokens only', async () => {
          const tx = await vault.setWhitelistedTokens(tokens, [true, false], { from })

          await assertEvent(tx, 'WhitelistedTokenSet', { token: tokens.first, whitelisted: true })
        })

        it('can be rolled back', async () => {
          await vault.setWhitelistedTokens(tokens, [true, false], { from })
          expect(await vault.isTokenWhitelisted(tokens.first)).to.be.true
          expect(await vault.isTokenWhitelisted(tokens.second)).to.be.false

          await vault.setWhitelistedTokens(tokens, [true, true], { from })
          expect(await vault.isTokenWhitelisted(tokens.first)).to.be.true
          expect(await vault.isTokenWhitelisted(tokens.second)).to.be.true

          await vault.setWhitelistedTokens(tokens, [true, false], { from })
          expect(await vault.isTokenWhitelisted(tokens.first)).to.be.true
          expect(await vault.isTokenWhitelisted(tokens.second)).to.be.false

          await vault.setWhitelistedTokens(tokens, [false, false], { from })
          expect(await vault.isTokenWhitelisted(tokens.first)).to.be.false
          expect(await vault.isTokenWhitelisted(tokens.second)).to.be.false
        })
      })
    })

    context('when the sender is not the admin', () => {
      beforeEach('set sender', async () => {
        from = other
      })

      it('reverts', async () => {
        await expect(vault.setWhitelistedTokens(new TokenList(), [], { from })).to.be.revertedWith('Ownable: caller is not the owner')
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

        it('emits an event for the whitelisted strategy only', async () => {
          const strategy1 = await deploy('StrategyMock', [tokens.first.address])
          const strategy2 = await deploy('StrategyMock', [tokens.second.address])

          const tx = await vault.setWhitelistedStrategies([strategy1, strategy2], [true, false], { from })

          await assertEvent(tx, 'WhitelistedStrategySet', { strategy: strategy1, whitelisted: true })
        })

        it('can be rolled back', async () => {
          const strategy1 = await deploy('StrategyMock', [tokens.first.address])
          const strategy2 = await deploy('StrategyMock', [tokens.second.address])

          await vault.setWhitelistedStrategies([strategy1, strategy2], [true, false], { from })
          expect(await vault.isStrategyWhitelisted(strategy1)).to.be.true
          expect(await vault.isStrategyWhitelisted(strategy2)).to.be.false

          await vault.setWhitelistedStrategies([strategy1, strategy2], [true, true], { from })
          expect(await vault.isStrategyWhitelisted(strategy1)).to.be.true
          expect(await vault.isStrategyWhitelisted(strategy2)).to.be.true

          await vault.setWhitelistedStrategies([strategy1, strategy2], [true, false], { from })
          expect(await vault.isStrategyWhitelisted(strategy1)).to.be.true
          expect(await vault.isStrategyWhitelisted(strategy2)).to.be.false

          await vault.setWhitelistedStrategies([strategy1, strategy2], [false, false], { from })
          expect(await vault.isStrategyWhitelisted(strategy1)).to.be.false
          expect(await vault.isStrategyWhitelisted(strategy2)).to.be.false
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
