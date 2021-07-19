import { BigInt, Address } from '@graphprotocol/graph-ts'

import { ManagersSet, StrategiesSet, WithdrawersSet, FeesConfigSet } from '../types/templates/Agreement/Agreement'
import { Agreement as AgreementEntity, Manager as ManagerEntity, Portfolio as PortfolioEntity } from '../types/schema'

export function handleWithdrawersSet(event: WithdrawersSet): void {
  event.params.withdrawers.forEach(withdrawer => {
    let agreement = loadOrCreateAgreement(event.address)
    let withdrawers = agreement.withdrawers
    withdrawers.push(withdrawer.toHexString())
    agreement.withdrawers = withdrawers
    agreement.save()
  })
}

export function handleManagersSet(event: ManagersSet): void {
  event.params.managers.forEach(managerAddress => {
    let agreement = loadOrCreateAgreement(event.address)
    let managers = agreement.managers
    managers.push(managerAddress.toHexString())
    agreement.managers = managers
    agreement.save()

    let manager = loadOrCreateManager(managerAddress)
    let agreements = manager.agreements
    agreements.push(event.address.toHexString())
    manager.agreements = agreements
    manager.save()
  })
}

export function handleStrategiesSet(event: StrategiesSet): void {
  let agreement = loadOrCreateAgreement(event.address)
  agreement.allowedStrategies = parseAllowedStrategies(event.params.allowedStrategies)
  agreement.save()

  event.params.customStrategies.forEach(strategy => {
    let agreement = loadOrCreateAgreement(event.address)
    let customStrategies = agreement.customStrategies
    customStrategies.push(strategy.toHexString())
    agreement.customStrategies = customStrategies
    agreement.save()
  })
}

export function handleFeesConfigSet(event: FeesConfigSet): void {
  let id = event.address.toHexString()
  let portfolio = PortfolioEntity.load(id) || new PortfolioEntity(id)
  portfolio.agreement = id
  portfolio.depositFee = event.params.depositFee
  portfolio.performanceFee = event.params.performanceFee
  portfolio.feeCollector = event.params.feeCollector
  portfolio.save()
}

function loadOrCreateAgreement(address: Address): AgreementEntity {
  let id = address.toHexString()
  let agreement = AgreementEntity.load(id)

  if (agreement === null) {
    agreement = new AgreementEntity(id)
    agreement.portfolio = id
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
    manager.agreements = []
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
