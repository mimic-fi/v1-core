import { BigInt, Address } from '@graphprotocol/graph-ts'

import { Agreement as AgreementContract } from '../types/templates/Agreement/Agreement'
import { ManagersSet, StrategiesSet, WithdrawersSet, FeesConfigSet } from '../types/templates/Agreement/Agreement'
import { Agreement as AgreementEntity, Manager as ManagerEntity, Portfolio as PortfolioEntity } from '../types/schema'

export function handleWithdrawersSet(event: WithdrawersSet): void {
  event.params.withdrawers.forEach(withdrawer => {
    let agreement = loadOrCreateAgreement(event.address)
    agreement.withdrawers.push(withdrawer.toHexString())
    agreement.save()
  })
}

export function handleManagersSet(event: ManagersSet): void {
  event.params.managers.forEach(managerAddress => {
    let agreement = loadOrCreateAgreement(event.address)
    agreement.managers.push(managerAddress.toHexString())
    agreement.save()

    let manager = loadOrCreateManager(managerAddress)
    manager.agreements.push(event.address.toHexString())
    manager.save()
  })
}

export function handleStrategiesSet(event: StrategiesSet): void {
  let agreement = loadOrCreateAgreement(event.address)
  agreement.allowedStrategies = parseAllowedStrategies(event.params.allowedStrategies)
  agreement.save()

  event.params.customStrategies.forEach(strategy => {
    let agreement = loadOrCreateAgreement(event.address)
    agreement.customStrategies.push(strategy.toHexString())
    agreement.save()
  })
}

export function handleFeesConfigSet(event: FeesConfigSet): void {
  let agreement = loadOrCreateAgreement(event.address)
  let portfolio = PortfolioEntity.load(agreement.portfolio)
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
    agreement.managers = []
    agreement.withdrawers = []
    agreement.customStrategies = []
    agreement.allowedStrategies = 'None'
    agreement.save()

    let portfolio = PortfolioEntity.load(id)
    if (portfolio == null) {
      portfolio = new PortfolioEntity(id)
      portfolio.depositFee = agreementContract.depositFee()
      portfolio.feeCollector = agreementContract.feeCollector()
      portfolio.performanceFee = agreementContract.performanceFee()
      portfolio.agreement = id
      portfolio.save()
    }
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
