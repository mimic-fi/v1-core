import { Contract } from 'ethers'
import { assertEvent, deploy, fp, getSigner, getSigners, instanceAt, MAX_UINT256 } from '@mimic-fi/v1-helpers'

import { toAddresses } from '../test/helpers/models/types'

import TokenList from '../test/helpers/models/tokens/TokenList'

async function benchmark(): Promise<void> {
  const protocolFee = fp(0.01)
  const priceOracle = await deploy('PriceOracleMock')
  const swapConnector = await deploy('SwapConnectorMock')
  const tokens = await TokenList.create(2)
  await tokens.mint(swapConnector, fp(1000000))
  const strategy1 = await deploy('StrategyMock', [tokens.first.address])
  const strategy2 = await deploy('StrategyMock', [tokens.second.address])
  const strategies = [strategy1, strategy2]
  const vault = await deploy('Vault', [protocolFee, priceOracle.address, swapConnector.address, tokens.addresses, toAddresses(strategies)])

  console.log('\n\n### Agreements ###')
  const agreement = await benchmarkAgreement(vault, tokens.addresses, toAddresses(strategies))

  console.log('\n\n### Vault (agreement) ###')
  await benchmarkVault(vault, agreement.address, strategies, tokens)

  console.log('\n\n### Vault (EOA) ###')
  const eoa = await getSigner()
  await tokens.first.approve(vault, MAX_UINT256)
  await benchmarkVault(vault, eoa.address, strategies, tokens)
}

async function benchmarkAgreement(vault: Contract, tokens: string[], strategies: string[]): Promise<Contract> {
  const factory = await deploy('AgreementFactory', [vault.address])

  const name = 'Test Agreement'
  const depositFee = fp(0.00005)
  const performanceFee = fp(0.00001)
  const maxSwapSlippage = fp(0.1)
  const [manager1, manager2, withdrawer1, withdrawer2, feeCollector] = toAddresses(await getSigners())
  const managers = [manager1, manager2]
  const withdrawers = [withdrawer1, withdrawer2]
  const allowedTokens = 2
  const allowedStrategies = 2
  const agreement1Tx = await factory.create(name, feeCollector, depositFee, performanceFee, maxSwapSlippage, managers, withdrawers, tokens, allowedTokens, strategies, allowedStrategies)
  const agreement2Tx = await factory.create(name, feeCollector, depositFee, performanceFee, maxSwapSlippage, [manager1], [withdrawer1], tokens, allowedTokens, strategies, allowedStrategies)
  const agreement3Tx = await factory.create(name, feeCollector, depositFee, performanceFee, maxSwapSlippage, [manager1], [withdrawer1], tokens, allowedTokens, [strategies[0]], allowedStrategies)
  const agreement4Tx = await factory.create(name, feeCollector, depositFee, performanceFee, maxSwapSlippage, [manager1], [withdrawer1], tokens, allowedTokens, [], allowedStrategies)
  const agreement5Tx = await factory.create(name, feeCollector, depositFee, performanceFee, maxSwapSlippage, [manager1], [withdrawer1], [], allowedTokens, [], allowedStrategies)

  console.log(`- 2 managers, 2 withdrawers, 2 tokens, 2 strategies: ${(await agreement1Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 2 tokens, 2 strategies: ${(await agreement2Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 2 tokens, 1 strategy: ${(await agreement3Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 2 tokens, 0 strategy: ${(await agreement4Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 0 tokens, 0 strategy: ${(await agreement5Tx.wait()).gasUsed}`)

  const { args } = await assertEvent(agreement1Tx, 'AgreementCreated', { name })
  return instanceAt('Agreement', args.agreement)
}

async function benchmarkVault(vault: Contract, account: string, strategies: Contract[], tokens: TokenList): Promise<void> {
  const token = tokens.first
  const strategy = strategies[0]
  await token.mint(account, fp(1000000))

  const deposit1Tx = await vault.deposit(account, token.address, fp(100))
  const deposit2Tx = await vault.deposit(account, token.address, fp(500))
  console.log(`- First deposit: \t${(await deposit1Tx.wait()).gasUsed}`)
  console.log(`- Second deposit: \t${(await deposit2Tx.wait()).gasUsed}`)

  const swap1Tx = await vault.swap(account, token.address, tokens.second.address, fp(50), fp(0.01), '0x')
  const swap2Tx = await vault.swap(account, token.address, tokens.second.address, fp(50), fp(0.01), '0x')
  console.log(`- First swap: \t\t${(await swap1Tx.wait()).gasUsed}`)
  console.log(`- Second swap: \t\t${(await swap2Tx.wait()).gasUsed}`)

  const join1Tx = await vault.join(account, strategy.address, fp(200), '0x')
  const join2Tx = await vault.join(account, strategy.address, fp(200), '0x')
  console.log(`- First join: \t\t${(await join1Tx.wait()).gasUsed}`)
  console.log(`- Second join: \t\t${(await join2Tx.wait()).gasUsed}`)

  const exit1Tx = await vault.exit(account, strategy.address, fp(0.5), '0x')
  const exit2Tx = await vault.exit(account, strategy.address, fp(1), '0x')
  console.log(`- Half exit: \t\t${(await exit1Tx.wait()).gasUsed}`)
  console.log(`- Full exit: \t\t${(await exit2Tx.wait()).gasUsed}`)

  const withdrawer = await getSigner(2)
  const withdraw1Tx = await vault.withdraw(account, token.address, fp(100), withdrawer.address)
  const withdraw2Tx = await vault.withdraw(account, token.address, fp(100), withdrawer.address)
  console.log(`- First withdraw: \t${(await withdraw1Tx.wait()).gasUsed}`)
  console.log(`- Second withdraw: \t${(await withdraw2Tx.wait()).gasUsed}`)
}

benchmark().then().catch(console.error)
