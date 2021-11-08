import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { loadOrCreateERC20 } from './ERC20'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Rate as RateEntity, Strategy as StrategyEntity, Vault as VaultEntity } from '../types/schema'

let ONE = BigInt.fromString('1000000000000000000')

export function loadOrCreateStrategy(strategyAddress: Address, vault: VaultEntity, event: ethereum.Event): StrategyEntity {
  let id = strategyAddress.toHexString()
  let strategy = StrategyEntity.load(id)

  if (strategy === null) {
    strategy = new StrategyEntity(id)
    strategy.vault = vault.id
    strategy.token = getStrategyToken(strategyAddress)
    strategy.whitelisted = false
    strategy.metadata = getStrategyMetadata(strategyAddress)
    strategy.shares = BigInt.fromI32(0)
    strategy.deposited = BigInt.fromI32(0)
    strategy.save()
    createLastRate(strategy!, event.block)
  }

  let strategies = vault.strategies
  strategies.push(id)
  vault.strategies = strategies
  vault.save()

  return strategy!
}

export function createLastRate(strategy: StrategyEntity, block: ethereum.Block): void {
  let currentRate = getStrategyRate(Address.fromString(strategy.id))

  if (strategy.lastRate === null) {
    storeLastRate(strategy, currentRate, BigInt.fromI32(0), block)
  } else {
    let lastRate = RateEntity.load(strategy.lastRate)!
    if (lastRate.value.notEqual(currentRate)) {
      let elapsed = block.number.minus(lastRate.block)
      let accumulated = lastRate.accumulated.plus(lastRate.value.times(elapsed))
      storeLastRate(strategy, currentRate, accumulated, block)
    }
  }
}

function storeLastRate(strategy: StrategyEntity, currentRate: BigInt, accumulated: BigInt, block: ethereum.Block): void {
  let shares = getStrategyShares(Address.fromString(strategy.id))
  let rateId = strategy.id + '-' + block.timestamp.toString()
  let rate = new RateEntity(rateId)
  rate.value = currentRate
  rate.accumulated = accumulated
  rate.shares = shares
  rate.strategy = strategy.id
  rate.timestamp = block.timestamp
  rate.block = block.number
  rate.save()

  strategy.lastRate = rateId
  strategy.deposited = shares.isZero() ? BigInt.fromI32(0) : shares.times(currentRate).div(ONE)
  strategy.save()
}

export function getStrategyRate(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let rateCall = strategyContract.try_getRate()

  if (!rateCall.reverted) {
    return rateCall.value
  }

  log.warning('getRate() call reverted for {}', [address.toHexString()])
  return BigInt.fromI32(0)
}

export function getStrategyShares(address: Address): BigInt {
  let strategyContract = StrategyContract.bind(address)
  let sharesCall = strategyContract.try_getTotalShares()

  if (!sharesCall.reverted) {
    return sharesCall.value
  }

  log.warning('getTotalShares() call reverted for {}', [address.toHexString()])
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

export function getStrategyToken(address: Address): string {
  let strategyContract = StrategyContract.bind(address)
  let tokenCall = strategyContract.try_getToken()

  if (!tokenCall.reverted) {
    let token = loadOrCreateERC20(tokenCall.value)
    return token.id
  }

  log.warning('getToken() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}
