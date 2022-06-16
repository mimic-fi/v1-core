import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts"

import { VAULT_ID } from "./Vault"
import { loadOrCreateERC20 } from "./ERC20"
import { Vault as VaultContract } from "../types/Vault/Vault"
import { Strategy as StrategyContract } from "../types/Vault/Strategy"
import {
  Strategy as StrategyEntity,
  Rate as RateEntity,
  Vault as VaultEntity,
} from "../types/schema"

let ONE = BigInt.fromString("1000000000000000000")

let SECONDS_IN_ONE_YEAR = BigInt.fromString("31536000")

let BUFFER_SIZE = BigInt.fromI32(1000) // ~7 days
let BUFFER_FOUR_HOURS_LENGTH = BigInt.fromI32(24) // ~4 hours
let MAX_BUFFER_ENTRY_DURATION = BigInt.fromI32(608) // ~10 min
let MIN_SAMPLE_DURATION = BigInt.fromI32(30) // 30 seconds

export function handleTick(event: ethereum.Event): void {
  let vault = VaultEntity.load(VAULT_ID)
  if (vault !== null && vault.strategies !== null) {
    let strategies = vault.strategies
    for (let i: i32 = 0; i < strategies.length; i++) {
      let strategy = StrategyEntity.load(strategies[i])
      if (strategy !== null) createLastRate(vault!, strategy!, event.block)
    }
  }
}

export function loadOrCreateStrategy(
  strategyAddress: Address,
  vault: VaultEntity,
  event: ethereum.Event
): StrategyEntity {
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
      rate.initialized = false
      rate.valueRate = BigInt.fromI32(0)
      rate.totalValue = BigInt.fromI32(0)
      rate.totalShares = BigInt.fromI32(0)
      rate.shareValue = BigInt.fromI32(0)
      rate.accumulatedShareValue = BigInt.fromI32(0)
      rate.updatedAt = event.block.timestamp
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

export function createLastRate(
  vault: VaultEntity,
  strategy: StrategyEntity,
  block: ethereum.Block
): void {
  let lastRate = RateEntity.load(
    strategy.lastRate || rateId(strategy, BigInt.fromI32(0))
  )
  if (block.number.equals(lastRate.block)) return

  //First rate treated as a special case because apr cannot be calculated  yet
  let firstRate = false
  let elapsed: BigInt
  if (!lastRate.initialized && lastRate.index.equals(BigInt.fromI32(0))) {
    firstRate = true
  } else {
    elapsed = block.timestamp.minus(lastRate.updatedAt)
    if (elapsed.lt(MIN_SAMPLE_DURATION)) return
  }

  let strategyAddress = Address.fromString(strategy.id)
  let totalValue = getStrategyValue(strategyAddress)
  let totalShares = getStrategyShares(
    Address.fromString(vault.address),
    strategyAddress
  )

  //If no investment has ever been made then apy cannot be calculated
  if (firstRate && totalShares.isZero()) return

  let requiresNewSample =
    !firstRate &&
    block.timestamp.minus(lastRate.createdAt).ge(MAX_BUFFER_ENTRY_DURATION)
  let currentIndex = requiresNewSample
    ? lastRate.index.plus(BigInt.fromI32(1)).mod(BUFFER_SIZE)
    : lastRate.index
  let currentRate = RateEntity.load(rateId(strategy, currentIndex))
  if (requiresNewSample)
    log.warning("New sample at {}", [currentIndex.toString()])

  let shareValue = totalShares.isZero()
    ? BigInt.fromI32(0)
    : totalValue.times(ONE).div(totalShares)
  let accumulatedShareValue: BigInt
  if (firstRate) {
    accumulatedShareValue = BigInt.fromI32(0)
  } else {
    if (totalShares.isZero()) {
      accumulatedShareValue = lastRate.accumulatedShareValue
    } else {
      let apr = shareValue
        .minus(lastRate.shareValue)
        .times(ONE)
        .div(lastRate.shareValue)
        .times(SECONDS_IN_ONE_YEAR)
        .div(elapsed)
      accumulatedShareValue = lastRate.accumulatedShareValue.plus(
        apr.times(elapsed)
      )
    }
  }

  if (requiresNewSample) {
    strategy.currentApr = calculateCurrentAPR(strategy, lastRate)
    strategy.lastWeekApr = calculateLastWeekAPR(
      strategy,
      currentRate,
      lastRate
    )
  }

  currentRate.valueRate = getStrategyValueRate(Address.fromString(strategy.id))
  currentRate.initialized = true
  currentRate.totalValue = totalValue
  currentRate.totalShares = totalShares
  currentRate.shareValue = shareValue
  currentRate.accumulatedShareValue = accumulatedShareValue
  currentRate.strategy = strategy.id
  currentRate.block = block.number
  currentRate.updatedAt = block.timestamp
  if (requiresNewSample) currentRate.createdAt = block.timestamp
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

  log.warning("getStrategyShares() call reverted for {} and strategy", [
    address.toHexString(),
    strategy.toHexString(),
  ])
  return BigInt.fromI32(0)
}

function getStrategyValue(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let getCurrentTotalValueCall = strategyContract.try_claimAndInvest()

  if (!getCurrentTotalValueCall.reverted) {
    return getCurrentTotalValueCall.value
  }

  log.warning("ClaimAndInvest() call reverted for {}", [address.toHexString()])

  let getTotalValueCall = strategyContract.try_getTotalValue()

  if (!getTotalValueCall.reverted) {
    return getTotalValueCall.value
  }

  log.warning(
    "Both claimAndInvest() and getTotalValue() call reverted for {}",
    [address.toHexString()]
  )
  return BigInt.fromI32(0)
}

function getStrategyValueRate(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let getValueRateCall = strategyContract.try_getValueRate()

  if (!getValueRateCall.reverted) {
    return getValueRateCall.value
  }

  log.warning("getValueRate() call reverted for {}", [address.toHexString()])
  return BigInt.fromI32(0)
}

export function getStrategyMetadata(address: Address): string {
  let strategyContract = StrategyContract.bind(address)
  let metadataCall = strategyContract.try_getMetadataURI()

  if (!metadataCall.reverted) {
    return metadataCall.value
  }

  log.warning("getMetadataURI() call reverted for {}", [address.toHexString()])
  return "Unknown"
}

export function getStrategyToken(address: Address): Address {
  let strategyContract = StrategyContract.bind(address)
  let tokenCall = strategyContract.try_getToken()

  if (!tokenCall.reverted) {
    loadOrCreateERC20(tokenCall.value)
    return tokenCall.value
  }

  log.warning("getToken() call reverted for {}", [address.toHexString()])
  return Address.fromString("0x0000000000000000000000000000000000000000")
}

function rateId(strategy: StrategyEntity, index: BigInt): string {
  return strategy.id + "#" + index.toString()
}

function calculateLastWeekAPR(
  strategy: StrategyEntity,
  initialRate: RateEntity | null,
  finalRate: RateEntity | null
): BigInt {
  //Check if it did never make one buffer round
  if (!initialRate.initialized) {
    initialRate = RateEntity.load(rateId(strategy, BigInt.fromI32(0)))
  }

  //Check for a special case at first when both are index = 0
  if (initialRate.index != finalRate.index) {
    return finalRate.accumulatedShareValue
      .minus(initialRate.accumulatedShareValue)
      .div(finalRate.updatedAt.minus(initialRate.updatedAt))
  } else return BigInt.fromI32(0)
}

function calculateCurrentAPR(
  strategy: StrategyEntity,
  lastRate: RateEntity | null
): BigInt {
  let previousIndex = lastRate.index
    .plus(BUFFER_SIZE)
    .minus(BUFFER_FOUR_HOURS_LENGTH)
    .mod(BUFFER_SIZE)
  let previousRate = RateEntity.load(rateId(strategy, previousIndex))

  if (!previousRate.initialized) {
    return BigInt.fromI32(0)
  }

  return lastRate.accumulatedShareValue
    .minus(previousRate.accumulatedShareValue)
    .div(lastRate.updatedAt.minus(previousRate.updatedAt))
}
