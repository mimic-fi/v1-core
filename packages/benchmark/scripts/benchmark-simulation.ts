import { assertEvent, deploy, fp, getSigners } from '@mimic-fi/v1-helpers'
import { encodeSlippage } from '@mimic-fi/v1-portfolios/dist/helpers/encoding'
import { toAddresses } from '@mimic-fi/v1-vault/test/helpers/types'

import ARTIFACTS from './artifacts'

// Vault config
const SWAP_RATE = fp(1.01)
const MAX_SLIPPAGE = fp(0.2) // 20 %
const PROTOCOL_FEE = fp(0.001) // 0.1 %

// Agreement config
const AGREEMENT_NAME = 'Test Agreement'
const DEPOSIT_FEE = fp(0.02) // 2%
const WITHDRAW_FEE = fp(0.01) // 2%
const PERFORMANCE_FEE = fp(0.15) // 15%
const MAX_SWAP_SLIPPAGE = fp(0.1) // 10%
const STRATEGIES_ALLOWED = 2 // any
const TOKENS_ALLOWED = 2 // any

// Strategies config
const DAI_STRATEGY_RATE = fp(1.02)
const USDC_STRATEGY_RATE = fp(1.03)

async function benchmark(): Promise<void> {
  const [manager1, manager2, withdrawer1, withdrawer2, feeCollector, admin] = await getSigners()
  const managers = toAddresses([manager1, manager2])
  const withdrawers = toAddresses([withdrawer1, withdrawer2])

  // Deploy dependencies
  const swapConnector = await deploy(ARTIFACTS.swapConnector)
  const priceOracle = await deploy(ARTIFACTS.priceOracle)
  const vaultArgs = [MAX_SLIPPAGE, PROTOCOL_FEE, priceOracle.address, swapConnector.address, [], []]

  // Deploy architecture
  const weth = await deploy(ARTIFACTS.weth)
  const vault = await deploy(ARTIFACTS.vault, vaultArgs, admin)
  const factory = await deploy(ARTIFACTS.agreementFactory, [weth.address, vault.address])
  console.log('swap connector:', swapConnector.address)
  console.log('price oracle:', priceOracle.address)
  console.log('vault:', vault.address)
  console.log('factory:', factory.address)

  // Deploy tokens
  const DAI = await deploy(ARTIFACTS.token, ['DAI'])
  const USDC = await deploy(ARTIFACTS.token, ['USDC'])
  const tokens = [DAI, USDC]
  await vault.connect(admin).setWhitelistedTokens(toAddresses(tokens), [true, true])

  // Deploy strategies
  const strategyDAI = await deploy(ARTIFACTS.strategy, [DAI.address])
  const strategyUSDC = await deploy(ARTIFACTS.strategy, [USDC.address])
  const strategies = [strategyDAI, strategyUSDC]
  await vault.connect(admin).setWhitelistedStrategies(toAddresses(strategies), [true, true])

  // Deploy agreement
  const agreementTx = await factory.create(
    AGREEMENT_NAME,
    feeCollector.address,
    DEPOSIT_FEE,
    WITHDRAW_FEE,
    PERFORMANCE_FEE,
    MAX_SWAP_SLIPPAGE,
    managers,
    withdrawers,
    [],
    TOKENS_ALLOWED,
    [],
    STRATEGIES_ALLOWED
  )
  const { args } = await assertEvent(agreementTx, 'AgreementCreated', { name: AGREEMENT_NAME })
  const agreement = args.agreement
  console.log('agreement:', agreement)

  // Deposit 100k DAI => 98k (2% deposit fee)
  console.log('depositing DAI...')
  await DAI.mint(agreement, fp(100e3))
  await vault.connect(manager1).deposit(agreement, DAI.address, fp(100e3), '0x')

  // Swap 50k DAI for USDC => 50.5k USDC (1% swap rate)
  console.log('swapping DAI for USDC...')
  await priceOracle.mockRate(SWAP_RATE)
  await swapConnector.mockRate(SWAP_RATE)
  await USDC.mint(swapConnector.address, fp(1000000))
  await vault.connect(manager1).swap(agreement, DAI.address, USDC.address, fp(50e3), fp(0.01), '0x')

  // Join USDC strategy 20k => 20.6k USDC (3% strategy rate)
  console.log('joining USDC strategy...')
  await vault.connect(manager2).join(agreement, strategyUSDC.address, fp(20e3), encodeSlippage(fp(0.01)))

  // Join DAI strategy 40k => 40.8k DAI (2% strategy rate)
  console.log('joining DAI strategy...')
  await vault.connect(manager2).join(agreement, strategyDAI.address, fp(40e3), encodeSlippage(fp(0.01)))

  // Exit 30% DAI => 12.24k DAI => protocol 0.24 => performance 35.964 => receives 12203.796
  console.log('exiting DAI strategy...')
  await DAI.mint(strategyDAI.address, (await DAI.balanceOf(strategyDAI.address)).mul(DAI_STRATEGY_RATE).div(fp(1)))
  await vault.connect(manager1).exit(agreement, strategyDAI.address, fp(0.3), false, encodeSlippage(fp(0.01)))

  // Exit 90% USDC => 18.54k USDC => protocol 0.54 => performance 80.919 => receives 18458.541
  console.log('exiting USDC strategy...')
  await USDC.mint(strategyUSDC.address, (await USDC.balanceOf(strategyUSDC.address)).mul(USDC_STRATEGY_RATE).div(fp(1)))
  await vault.connect(manager1).exit(agreement, strategyUSDC.address, fp(0.9), false, encodeSlippage(fp(0.01)))

  // Withdraw USDC earnings 458.541 => 18k USDC
  console.log('withdrawing USDC strategy...')
  await vault.connect(manager1).withdraw(agreement, USDC.address, fp(458.541), withdrawer1.address, '0x')

  // Increase strategy rates by 1%
  console.log('mocking swap rates...')
  await DAI.mint(strategyDAI.address, (await DAI.balanceOf(strategyDAI.address)).mul(101).div(100))
  await USDC.mint(strategyUSDC.address, (await USDC.balanceOf(strategyUSDC.address)).mul(101).div(100))
}

benchmark().catch((error) => {
  console.error(error)
  process.exit(1)
})
