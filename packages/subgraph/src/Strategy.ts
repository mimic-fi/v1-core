import { BigInt, Address, ethereum, log } from '@graphprotocol/graph-ts'

import { loadOrCreateERC20 } from './ERC20'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Strategy as StrategyEntity, Rate as RateEntity, Vault as VaultEntity } from '../types/schema'

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
    createLastRate(strategy!, event.block.timestamp)
  }

  return strategy!
}

export function createLastRate(strategy: StrategyEntity, timestamp: BigInt): void {
  let strategyContract = StrategyContract.bind(Address.fromString(strategy.id))
  let shares = strategyContract.getTotalShares()
  let value = shares.isZero() ? BigInt.fromI32(0) : strategyContract.getTokenBalance().div(shares)

  let rateId = strategy.id + '-' + timestamp.toString()
  let rate = new RateEntity(rateId)
  rate.value = value
  rate.strategy = strategy.id
  rate.timestamp = timestamp
  rate.save()

  strategy.lastRate = rateId
  strategy.deposited = shares.times(value).div(BigInt.fromString('1000000000000000000'))
  strategy.save()
}

export function getStrategyMetadata(address: Address): string {
  let strategyContract = StrategyContract.bind(address)
  let metadataCall = strategyContract.try_getMetadataURI();

  if (!metadataCall.reverted) {
    return metadataCall.value
  }

  log.warning('getMetadataURI() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}

export function getStrategyToken(address: Address): string {
  let strategyContract = StrategyContract.bind(address)
  let tokenCall = strategyContract.try_getToken();

  if (!tokenCall.reverted) {
    let token = loadOrCreateERC20(tokenCall.value)
    return token.id
  }

  log.warning('getToken() call reverted for {}', [address.toHexString()])
  return 'Unknown'
}
