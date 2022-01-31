import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { loadOrCreateERC20 } from './ERC20'
import { Vault as VaultContract } from '../types/Vault/Vault'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Strategy as StrategyEntity, Rate as RateEntity, Vault as VaultEntity } from '../types/schema'

let ONE = BigInt.fromString('1000000000000000000')

export function loadOrCreateStrategy(strategyAddress: Address, vault: VaultEntity, event: ethereum.Event): StrategyEntity {
  let id = strategyAddress.toHexString()
  let strategy = StrategyEntity.load(id)

  if (strategy === null) {
    strategy = new StrategyEntity(id)
    strategy.vault = vault.id
    strategy.token = getStrategyToken(strategyAddress).toHexString()
    strategy.metadata = getStrategyMetadata(strategyAddress)
    strategy.whitelisted = false
    strategy.save()
    createLastRate(vault, strategy!, event.block)
  }

  let strategies = vault.strategies
  strategies.push(id)
  vault.strategies = strategies
  vault.save()

  return strategy!
}

export function createLastRate(vault: VaultEntity, strategy: StrategyEntity, block: ethereum.Block): void {
  let strategyAddress = Address.fromString(strategy.id)
  let totalValue = getStrategyValue(strategyAddress)
  let totalShares = getStrategyShares(Address.fromString(vault.address), strategyAddress)
  let shareValue = totalShares.isZero() ? BigInt.fromI32(0) : totalValue.times(ONE).div(totalShares)

  if (strategy.lastRate === null) {
    storeLastRate(strategy, totalValue, totalShares, shareValue, BigInt.fromI32(0), block);
  } else {
    let lastRate = RateEntity.load(strategy.lastRate)!
    if (lastRate.shareValue.notEqual(shareValue)) {
      let elapsed = block.number.minus(lastRate.block)
      let accumulated = lastRate.accumulatedShareValue.plus(lastRate.shareValue.times(elapsed))
      storeLastRate(strategy, totalValue, totalShares, shareValue, accumulated, block);
    }
  }
}

function storeLastRate(strategy: StrategyEntity, totalValue: BigInt, totalShares: BigInt, shareValue: BigInt, accumulated: BigInt, block: ethereum.Block): void {
  let rateId = strategy.id + '-' + block.timestamp.toString()
  let rate = new RateEntity(rateId)
  rate.valueRate = getStrategyValueRate(Address.fromString(strategy.id))
  rate.totalValue = totalValue
  rate.totalShares = totalShares
  rate.shareValue = shareValue
  rate.accumulatedShareValue = accumulated
  rate.strategy = strategy.id
  rate.timestamp = block.timestamp
  rate.block = block.number
  rate.save()

  strategy.lastRate = rateId
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
