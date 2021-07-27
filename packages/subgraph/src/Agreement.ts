import { BigInt, Address } from '@graphprotocol/graph-ts'

import { Agreement as AgreementContract } from '../types/Vault/Agreement'
import { ManagersSet, StrategiesSet, WithdrawersSet, FeesConfigSet } from '../types/templates/Agreement/Agreement'
import { Agreement as AgreementEntity, Manager as ManagerEntity, Portfolio as PortfolioEntity } from '../types/schema'

export function handleWithdrawersSet(event: WithdrawersSet): void {
  let agreement = loadOrCreateAgreement(event.address)
  let withdrawers = agreement.withdrawers
  let eventWithdrawers = event.params.withdrawers;

  for (let i: i32 = 0; i < eventWithdrawers.length; i++) {
    let withdrawer = eventWithdrawers[i]
    withdrawers.push(withdrawer.toHexString())
  }

  agreement.withdrawers = withdrawers
  agreement.save()
}

export function handleManagersSet(event: ManagersSet): void {
  let agreement = loadOrCreateAgreement(event.address)
  let managers = agreement.managers
  let eventManagers = event.params.managers

  for (let i: i32 = 0; i < eventManagers.length; i++) {
    let manager = loadOrCreateManager(eventManagers[i])
    managers.push(manager.id)
  }

  agreement.managers = managers
  agreement.save()
}

export function handleStrategiesSet(event: StrategiesSet): void {
  let agreement = loadOrCreateAgreement(event.address)
  let customStrategies = agreement.customStrategies
  let eventStrategies = event.params.customStrategies

  for (let i: i32 = 0; i < eventStrategies.length; i++) {
    let strategy = eventStrategies[i]
    customStrategies.push(strategy.toHexString())
  }

  agreement.customStrategies = customStrategies
  agreement.allowedStrategies = parseAllowedStrategies(event.params.allowedStrategies)
  agreement.save()
}

export function handleFeesConfigSet(event: FeesConfigSet): void {
  let id = event.address.toHexString()
  let portfolio = PortfolioEntity.load(id) || new PortfolioEntity(id)
  portfolio.depositFee = event.params.depositFee
  portfolio.performanceFee = event.params.performanceFee
  portfolio.feeCollector = event.params.feeCollector
  portfolio.save()
}

function loadOrCreateAgreement(address: Address): AgreementEntity {
  let id = address.toHexString()
  let agreement = AgreementEntity.load(id)

  if (agreement === null) {
    let agreementContract = AgreementContract.bind(address)
    agreement = new AgreementEntity(id)
    agreement.portfolio = id
    agreement.name = agreementContract.name()
    agreement.managers = []
    agreement.withdrawers = []
    agreement.customStrategies = []
    agreement.allowedStrategies = 'None'
    agreement.save()
  }

  return agreement!
}

function loadOrCreateManager(managerAddress: Address): ManagerEntity {
  let id = managerAddress.toHexString()
  let manager = ManagerEntity.load(id)

  if (manager === null) {
    manager = new ManagerEntity(id)
    manager.save()
  }

  return manager!
}

function parseAllowedStrategies(allowedStrategies: BigInt): string {
  if (allowedStrategies.equals(BigInt.fromI32(0))) return 'Any'
  if (allowedStrategies.equals(BigInt.fromI32(1))) return 'None'
  if (allowedStrategies.equals(BigInt.fromI32(2))) return 'Whitelisted'
  return 'unknown'
}
