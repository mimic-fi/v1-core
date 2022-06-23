import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { NOW } from './now'
import { VAULT_ID } from './Vault'
import { loadOrCreateERC20 } from './ERC20'
import { Vault as VaultContract } from '../types/Vault/Vault'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Strategy as StrategyEntity, Rate as RateEntity, Vault as VaultEntity } from '../types/schema'

let ONE = BigInt.fromString('1000000000000000000')
let SECONDS_IN_ONE_YEAR = BigInt.fromString('31536000')

let BUFFER_SIZE = BigInt.fromI32(1000) // 1000 entries
let MAX_BUFFER_ENTRY_DURATION = BigInt.fromI32(60 * 10) // 10 minutes
let MAX_TOTAL_BUFFER_DURATION = BUFFER_SIZE.times(MAX_BUFFER_ENTRY_DURATION) // ~7 days

let MIN_SAMPLE_DURATION = BigInt.fromI32(30) // 30 seconds
let BUFFER_FOUR_HOURS_LENGTH = BigInt.fromI32(24) // 4 hours = 24 samples

export function handleTick(event: ethereum.Event): void {
  // Skip if current block timestamp is before one week in the past
  let threshold = BigInt.fromString(NOW).minus(MAX_TOTAL_BUFFER_DURATION)
  if (event.block.timestamp.lt(threshold)) return

  let vault = VaultEntity.load(VAULT_ID)
  if (vault !== null && vault.strategies !== null) {
    let strategies = vault.strategies
    for (let i: i32 = 0; i < strategies.length; i++) {
      let strategy = StrategyEntity.load(strategies[i])
      if (strategy !== null) createLastRate(vault!, strategy!, event.block)
    }
  }
}

export function loadOrCreateStrategy(strategyAddress: Address, vault: VaultEntity, event: ethereum.Event):
  StrategyEntity
{
  let id = strategyAddress.toHexString()
  let strategy = StrategyEntity.load(id)

  if (strategy === null) {
    strategy = new StrategyEntity(id)
    strategy.vault = vault.id
    strategy.token = getStrategyToken(strategyAddress).toHexString()
    strategy.metadata = getStrategyMetadata(strategyAddress)
    strategy.whitelisted = false
    strategy.rates = []
    strategy.currentApr = BigInt.fromI32(0)
    strategy.lastWeekApr = BigInt.fromI32(0)
    strategy.save()

    let rates = strategy.rates
    for (let i: i32 = 0; i < BUFFER_SIZE.toI32(); i++) {
      let index = BigInt.fromI32(i)
      let rate = new RateEntity(rateId(strategy!, index))
      rate.index = index
      rate.valueRate = BigInt.fromI32(0)
      rate.totalValue = BigInt.fromI32(0)
      rate.totalShares = BigInt.fromI32(0)
      rate.shareValue = BigInt.fromI32(0)
      rate.accumulatedShareValue = BigInt.fromI32(0)
      rate.updatedAt = BigInt.fromI32(0)
      rate.createdAt = event.block.timestamp
      rate.block = event.block.number
      rate.strategy = strategy.id
      rate.save()
      rates.push(i.toString())
    }
    
    strategy.rates = rates
    strategy.save()
  }

  let strategies = vault.strategies
  strategies.push(id)
  vault.strategies = strategies
  vault.save()

  return strategy!
}

export function createLastRate(vault: VaultEntity, strategy: StrategyEntity, block: ethereum.Block): void {
  let lastRate = strategy.lastRate ? RateEntity.load(strategy.lastRate)! : firstRate(strategy)
  if (block.number.equals(lastRate.block)) return

  let strategyAddress = Address.fromString(strategy.id)
  let totalValue = getStrategyValue(strategyAddress)
  let totalShares = getStrategyShares(Address.fromString(vault.address), strategyAddress)
  let shareValue = totalShares.isZero() ? BigInt.fromI32(0) : totalValue.times(ONE).div(totalShares)

  let currentRate: RateEntity
  let accumulatedShareValue: BigInt

  // The first time a rate is tracked, the current APR cannot be tracked with the previous historic values
  if (isNotInitialized(lastRate) && lastRate.index.equals(BigInt.fromI32(0))) {
    // If there were no investments made, APR cannot be calculated
    if (totalShares.isZero()) return

    currentRate = lastRate
    accumulatedShareValue = BigInt.fromI32(0)
  } else {
    // If the current tick does not cover the minimum time window between samples, skip it
    let elapsed = block.timestamp.minus(lastRate.updatedAt)
    if (elapsed.lt(MIN_SAMPLE_DURATION)) return

    let requiresNewSample = block.timestamp.minus(lastRate.createdAt).ge(MAX_BUFFER_ENTRY_DURATION)
    let currentIndex = requiresNewSample ? lastRate.index.plus(BigInt.fromI32(1)).mod(BUFFER_SIZE) : lastRate.index
    currentRate = RateEntity.load(rateId(strategy, currentIndex))!

    // If shares went to zero, simply keep the old accumulated share value
    if (totalShares.isZero()) {
      accumulatedShareValue = lastRate.accumulatedShareValue
    } else {
      let increaseRatio = shareValue.minus(lastRate.shareValue).times(ONE).div(lastRate.shareValue)
      let apr = increaseRatio.times(SECONDS_IN_ONE_YEAR).div(elapsed)
      accumulatedShareValue = lastRate.accumulatedShareValue.plus(apr.times(elapsed))
    }

    // If we are writing a new sample in the buffer we can start calculating the current and weekly APRs
    if (requiresNewSample) {
      log.warning('New sample at {}', [currentIndex.toString()])
      currentRate.createdAt = block.timestamp
      strategy.currentApr = calculateCurrentAPR(strategy, lastRate)
      strategy.lastWeekApr = calculateLastWeekAPR(strategy, currentRate, lastRate)
    }
  }

  currentRate.valueRate = getStrategyValueRate(Address.fromString(strategy.id))
  currentRate.totalValue = totalValue
  currentRate.totalShares = totalShares
  currentRate.shareValue = shareValue
  currentRate.accumulatedShareValue = accumulatedShareValue
  currentRate.strategy = strategy.id
  currentRate.block = block.number
  currentRate.updatedAt = block.timestamp
  currentRate.save()

  strategy.lastRate = currentRate.id
  strategy.save()
}

function getStrategyShares(address: Address, strategy: Address): BigInt {
  let vaultContract = VaultContract.bind(address)
  let getStrategySharesCall = vaultContract.try_getStrategyShares(strategy)

  if (!getStrategySharesCall.reverted) {
    return getStrategySharesCall.value
  }

  log.warning('getStrategyShares() call reverted for {} and strategy', [address.toHexString(), strategy.toHexString()])
  return BigInt.fromI32(0)
}

function getStrategyValue(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let getCurrentTotalValueCall = strategyContract.try_claimAndInvest()

  if (!getCurrentTotalValueCall.reverted) {
    return getCurrentTotalValueCall.value
  }

  log.warning('claimAndInvest() call reverted for {}', [address.toHexString()])

  let getTotalValueCall = strategyContract.try_getTotalValue()

  if (!getTotalValueCall.reverted) {
    return getTotalValueCall.value
  }

  log.warning('Both claimAndInvest() and getTotalValue() call reverted for {}', [address.toHexString()])
  return BigInt.fromI32(0)
}

function getStrategyValueRate(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let getValueRateCall = strategyContract.try_getValueRate()

  if (!getValueRateCall.reverted) {
    return getValueRateCall.value
  }

  log.warning('getValueRate() call reverted for {}', [address.toHexString()])
  return BigInt.fromI32(0)
}

export function getStrategyMetadata(address: Address): string {
  let strategyContract = StrategyContract.bind(address)
  let metadataCall = strategyContract.try_getMetadataURI()

  if (!metadataCall.reverted) {
    return metadataCall.value
  }

  log.warning('getMetadataURI() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}

export function getStrategyToken(address: Address): Address {
  let strategyContract = StrategyContract.bind(address)
  let tokenCall = strategyContract.try_getToken()

  if (!tokenCall.reverted) {
    loadOrCreateERC20(tokenCall.value)
    return tokenCall.value
  }

  log.warning('getToken() call reverted for {}', [address.toHexString()])
  return Address.fromString('0x0000000000000000000000000000000000000000')
}

function rateId(strategy: StrategyEntity, index: BigInt): string {
  return strategy.id + '#' + index.toString()
}

function firstRate(strategy: StrategyEntity): RateEntity {
  return RateEntity.load(rateId(strategy, BigInt.fromI32(0)))!
}

function isNotInitialized(rate: RateEntity | null): boolean {
  return rate.updatedAt.equals(BigInt.fromI32(0))
}

function calculateLastWeekAPR(strategy: StrategyEntity, currentRate: RateEntity | null, newestRate: RateEntity | null):
  BigInt
{
  // If the buffer is not completed, the oldest rate is the one at index 0, otherwise it will be the rate
  // stored at the index we are about to overwrite, then we can use it before updating it
  let oldestRate = isNotInitialized(currentRate) ? firstRate(strategy) : currentRate

  // If both the oldest and newest rates are the same, we cannot calculate the weekly APR
  if (oldestRate.index == newestRate.index) return BigInt.fromI32(0)

  return newestRate.accumulatedShareValue
    .minus(oldestRate.accumulatedShareValue)
    .div(newestRate.updatedAt.minus(oldestRate.updatedAt))
}

function calculateCurrentAPR(strategy: StrategyEntity, lastRate: RateEntity | null): BigInt {
  let fourHoursBeforeIndex = lastRate.index.plus(BUFFER_SIZE).minus(BUFFER_FOUR_HOURS_LENGTH).mod(BUFFER_SIZE)
  let fourHoursBeforeRate = RateEntity.load(rateId(strategy, fourHoursBeforeIndex))

  // If the sample four hours before is not initialized, we can pick the first sample of the buffer instead
  fourHoursBeforeRate = isNotInitialized(fourHoursBeforeRate) ? firstRate(strategy) : fourHoursBeforeRate

  // If the sample picked is the last rate, we cannot calculate the current APR
  if (fourHoursBeforeRate.index == lastRate.index) return BigInt.fromI32(0)

  return lastRate.accumulatedShareValue
    .minus(fourHoursBeforeRate.accumulatedShareValue)
    .div(lastRate.updatedAt.minus(fourHoursBeforeRate.updatedAt))
}
