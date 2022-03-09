import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { VAULT_ID } from './Vault'
import { loadOrCreateERC20 } from './ERC20'
import { Vault as VaultContract } from '../types/Vault/Vault'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Strategy as StrategyEntity, Rate as RateEntity, Vault as VaultEntity } from '../types/schema'

let ONE = BigInt.fromString('1000000000000000000')

let BUFFER_SIZE = BigInt.fromI32(1000) // ~41 days
let MAX_BUFFER_ENTRY_DURATION = BigInt.fromI32(60 * 60) // 1 hour
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

export function loadOrCreateStrategy(strategyAddress: Address, vault: VaultEntity, event: ethereum.Event): StrategyEntity {
  let id = strategyAddress.toHexString()
  let strategy = StrategyEntity.load(id)

  if (strategy === null) {
    strategy = new StrategyEntity(id)
    strategy.vault = vault.id
    strategy.token = getStrategyToken(strategyAddress).toHexString()
    strategy.metadata = getStrategyMetadata(strategyAddress)
    strategy.whitelisted = false
    strategy.rates = []
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

export function createLastRate(vault: VaultEntity, strategy: StrategyEntity, block: ethereum.Block): void {
  let lastRate = RateEntity.load(strategy.lastRate || rateId(strategy, BigInt.fromI32(0)))
  if (block.number.equals(lastRate.block)) return

  let elapsed = block.timestamp.minus(lastRate.updatedAt)
  if (elapsed.lt(MIN_SAMPLE_DURATION)) return

  let requiresNewSample = block.timestamp.minus(lastRate.createdAt).ge(MAX_BUFFER_ENTRY_DURATION)
  let currentIndex = requiresNewSample ? lastRate.index.plus(BigInt.fromI32(1)).mod(BUFFER_SIZE) : lastRate.index
  let currentRate = RateEntity.load(rateId(strategy, currentIndex))
  if (requiresNewSample) log.warning('New sample at {}', [currentIndex.toString()])

  let strategyAddress = Address.fromString(strategy.id)
  let totalValue = getStrategyValue(strategyAddress)
  let totalShares = getStrategyShares(Address.fromString(vault.address), strategyAddress)
  let shareValue = totalShares.isZero() ? BigInt.fromI32(0) : totalValue.times(ONE).div(totalShares)
  let accumulatedShareValue = lastRate.accumulatedShareValue.plus(lastRate.shareValue.times(elapsed))

  currentRate.valueRate = getStrategyValueRate(Address.fromString(strategy.id))
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

  log.warning('getStrategyShares() call reverted for {} and strategy', [address.toHexString(), strategy.toHexString()])
  return BigInt.fromI32(0)
}

function getStrategyValue(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let getTotalValueCall = strategyContract.try_getTotalValue()

  if (!getTotalValueCall.reverted) {
    return getTotalValueCall.value
  }

  log.warning('getTotalValue() call reverted for {}', [address.toHexString()])
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