import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts'

import { loadOrCreateERC20 } from './ERC20'
import { Vault as VaultContract } from '../types/Vault/Vault'
import { Strategy as StrategyContract } from '../types/Vault/Strategy'
import { Strategy as StrategyEntity, StrategyCheckpoint as StrategyCheckpointEntity, Vault as VaultEntity } from '../types/schema'

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
    createLastStrategyCheckpoint(vault, strategy!, event.block)
  }

  let strategies = vault.strategies
  strategies.push(id)
  vault.strategies = strategies
  vault.save()

  return strategy!
}

export function createLastStrategyCheckpoint(vault: VaultEntity, strategy: StrategyEntity, block: ethereum.Block): void {
  let strategyAddress = Address.fromString(strategy.id)
  let totalValue = getStrategyValue(strategyAddress)
  let totalShares = getStrategyShares(Address.fromString(vault.id), strategyAddress)
  let shareValue = totalValue.times(ONE).div(totalShares)

  if (strategy.lastCheckpoint === null) {
    storeLastCheckpoint(strategy, totalValue, totalShares, shareValue, BigInt.fromI32(0), block);
  } else {
    let lastCheckpoint = StrategyCheckpointEntity.load(strategy.lastCheckpoint)!
    if (lastCheckpoint.shareValue.notEqual(shareValue)) {
      let elapsed = block.number.minus(lastCheckpoint.block)
      let accumulated = lastCheckpoint.accumulatedShareValue.plus(lastCheckpoint.shareValue.times(elapsed))
      storeLastCheckpoint(strategy, totalValue, totalShares, shareValue, accumulated, block);
    }
  }
}

function storeLastCheckpoint(strategy: StrategyEntity, totalValue: BigInt, totalShares: BigInt, shareValue: BigInt, accumulated: BigInt, block: ethereum.Block): void {
  let checkpointId = strategy.id + '-' + block.timestamp.toString()
  let checkpoint = new StrategyCheckpointEntity(checkpointId)
  checkpoint.totalValue = totalValue
  checkpoint.totalShares = totalShares
  checkpoint.shareValue = shareValue
  checkpoint.accumulatedShareValue = accumulated
  checkpoint.strategy = strategy.id
  checkpoint.timestamp = block.timestamp
  checkpoint.block = block.number
  checkpoint.save()

  strategy.lastCheckpoint = checkpointId
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
