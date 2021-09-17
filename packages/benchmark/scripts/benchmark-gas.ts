import { assertEvent, deploy, fp, getSigner, getSigners, instanceAt, MAX_UINT256 } from '@mimic-fi/v1-helpers'
import { Contract } from 'ethers'

import ARTIFACTS from './artifacts'

async function benchmark(): Promise<void> {
  const protocolFee = fp(0.01)
  const priceOracle = await deploy(ARTIFACTS.priceOracle)
  const swapConnector = await deploy(ARTIFACTS.swapConnector)
  const token1 = await deploy(ARTIFACTS.token, ['DAI'])
  const token2 = await deploy(ARTIFACTS.token, ['USDC'])
  const tokens = [token1.address, token2.address]
  const strategy1 = await deploy(ARTIFACTS.strategy, [token1.address])
  const strategy2 = await deploy(ARTIFACTS.strategy, [token2.address])
  const strategies = [strategy1.address, strategy2.address]
  const vault = await deploy(ARTIFACTS.vault, [
    protocolFee,
    priceOracle.address,
    swapConnector.address,
    tokens,
    strategies,
  ])

  await token1.mint(swapConnector.address, fp(1000000))
  await token2.mint(swapConnector.address, fp(1000000))

  console.log('\n\n### Agreements ###')
  const agreement = await benchmarkAgreement(vault, tokens, strategies)

  console.log('\n\n### Vault (agreement) ###')
  await token1.mint(agreement.address, fp(1000000))
  await token2.mint(agreement.address, fp(1000000))
  await benchmarkVault(vault, agreement.address, strategies, tokens)

  console.log('\n\n### Vault (EOA) ###')
  const eoa = await getSigner()
  await token1.mint(eoa.address, fp(1000000))
  await token2.mint(eoa.address, fp(1000000))
  await token1.approve(vault.address, MAX_UINT256)
  await benchmarkVault(vault, eoa.address, strategies, tokens)
}

async function benchmarkAgreement(vault: Contract, tokens: string[], strategies: string[]): Promise<Contract> {
  const factory = await deploy(ARTIFACTS.agreementFactory, [vault.address])

  const name = 'Test Agreement'
  const depositFee = fp(0.005)
  const withdrawFee = fp(0.003)
  const performanceFee = fp(0.00001)
  const maxSwapSlippage = fp(0.1)
  const [manager1, manager2, withdrawer1, withdrawer2, feeCollector] = await getSigners()
  const managers = [manager1.address, manager2.address]
  const withdrawers = [withdrawer1.address, withdrawer2.address]
  const allowed = 2

  const agreement1Tx = await factory.create(
    name,
    feeCollector.address,
    depositFee,
    withdrawFee,
    performanceFee,
    maxSwapSlippage,
    managers,
    withdrawers,
    tokens,
    allowed,
    strategies,
    allowed
  )

  const agreement2Tx = await factory.create(
    name,
    feeCollector.address,
    depositFee,
    withdrawFee,
    performanceFee,
    maxSwapSlippage,
    [manager1.address],
    [withdrawer1.address],
    tokens,
    allowed,
    strategies,
    allowed
  )

  const agreement3Tx = await factory.create(
    name,
    feeCollector.address,
    depositFee,
    withdrawFee,
    performanceFee,
    maxSwapSlippage,
    [manager1.address],
    [withdrawer1.address],
    tokens,
    allowed,
    [strategies[0]],
    allowed
  )

  const agreement4Tx = await factory.create(
    name,
    feeCollector.address,
    depositFee,
    withdrawFee,
    performanceFee,
    maxSwapSlippage,
    [manager1.address],
    [withdrawer1.address],
    tokens,
    allowed,
    [],
    allowed
  )

  const agreement5Tx = await factory.create(
    name,
    feeCollector.address,
    depositFee,
    withdrawFee,
    performanceFee,
    maxSwapSlippage,
    [manager1.address],
    [withdrawer1.address],
    [],
    allowed,
    [],
    allowed
  )

  console.log(`- 2 managers, 2 withdrawers, 2 tokens, 2 strategies: ${(await agreement1Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 2 tokens, 2 strategies: ${(await agreement2Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 2 tokens, 1 strategy: ${(await agreement3Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 2 tokens, 0 strategy: ${(await agreement4Tx.wait()).gasUsed}`)
  console.log(`- 1 managers, 1 withdrawers, 0 tokens, 0 strategy: ${(await agreement5Tx.wait()).gasUsed}`)

  const { args } = await assertEvent(agreement1Tx, 'AgreementCreated', { name })
  return instanceAt('@mimic-fi/v1-agreements/artifacts/contracts/Agreement.sol/Agreement', args.agreement)
}

async function benchmarkVault(vault: Contract, account: string, strategies: string[], tokens: string[]): Promise<void> {
  const [strategy] = strategies
  const [token, anotherToken] = tokens

  const deposit1Tx = await vault.deposit(account, token, fp(100))
  const deposit2Tx = await vault.deposit(account, token, fp(500))
  console.log(`- First deposit: \t${(await deposit1Tx.wait()).gasUsed}`)
  console.log(`- Second deposit: \t${(await deposit2Tx.wait()).gasUsed}`)

  const swap1Tx = await vault.swap(account, token, anotherToken, fp(50), fp(0.01), '0x')
  const swap2Tx = await vault.swap(account, token, anotherToken, fp(50), fp(0.01), '0x')
  console.log(`- First swap: \t\t${(await swap1Tx.wait()).gasUsed}`)
  console.log(`- Second swap: \t\t${(await swap2Tx.wait()).gasUsed}`)

  const join1Tx = await vault.join(account, strategy, fp(200), '0x')
  const join2Tx = await vault.join(account, strategy, fp(200), '0x')
  console.log(`- First join: \t\t${(await join1Tx.wait()).gasUsed}`)
  console.log(`- Second join: \t\t${(await join2Tx.wait()).gasUsed}`)

  const exit1Tx = await vault.exit(account, strategy, fp(0.5), false, '0x')
  const exit2Tx = await vault.exit(account, strategy, fp(1), false, '0x')
  console.log(`- Half exit: \t\t${(await exit1Tx.wait()).gasUsed}`)
  console.log(`- Full exit: \t\t${(await exit2Tx.wait()).gasUsed}`)

  const withdrawer = await getSigner(2)
  const withdraw1Tx = await vault.withdraw(account, token, fp(100), withdrawer.address)
  const withdraw2Tx = await vault.withdraw(account, token, fp(100), withdrawer.address)
  console.log(`- First withdraw: \t${(await withdraw1Tx.wait()).gasUsed}`)
  console.log(`- Second withdraw: \t${(await withdraw2Tx.wait()).gasUsed}`)
}

benchmark().catch(console.error)
