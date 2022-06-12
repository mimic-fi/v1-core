import { BigInt, Address } from "@graphprotocol/graph-ts";

import {
  ManagersSet,
  AllowedTokensSet,
  AllowedStrategiesSet,
  WithdrawersSet,
  ParamsSet,
} from "../types/templates/Agreement/Agreement";
import {
  Agreement as AgreementEntity,
  Manager as ManagerEntity,
  Portfolio as PortfolioEntity,
} from "../types/schema";

export function handleWithdrawersSet(event: WithdrawersSet): void {
  let agreement = loadOrCreateAgreement(event.address);
  let withdrawers = agreement.withdrawers;
  let eventWithdrawers = event.params.withdrawers;

  for (let i: i32 = 0; i < eventWithdrawers.length; i++) {
    let withdrawer = eventWithdrawers[i];
    withdrawers.push(withdrawer.toHexString());
  }

  agreement.withdrawers = withdrawers;
  agreement.save();
}

export function handleManagersSet(event: ManagersSet): void {
  let agreement = loadOrCreateAgreement(event.address);
  let managers = agreement.managers;
  let eventManagers = event.params.managers;

  for (let i: i32 = 0; i < eventManagers.length; i++) {
    let manager = loadOrCreateManager(eventManagers[i]);
    managers.push(manager.id);
  }

  agreement.managers = managers;
  agreement.save();
}

export function handleAllowedTokensSet(event: AllowedTokensSet): void {
  let agreement = loadOrCreateAgreement(event.address);
  let customTokens = agreement.customStrategies;
  let eventTokens = event.params.customTokens;

  for (let i: i32 = 0; i < eventTokens.length; i++) {
    let token = eventTokens[i];
    customTokens.push(token.toHexString());
  }

  agreement.customTokens = customTokens;
  agreement.allowedTokens = parseAllowed(event.params.allowedTokens);
  agreement.save();
}

export function handleAllowedStrategiesSet(event: AllowedStrategiesSet): void {
  let agreement = loadOrCreateAgreement(event.address);
  let customStrategies = agreement.customStrategies;
  let eventStrategies = event.params.customStrategies;

  for (let i: i32 = 0; i < eventStrategies.length; i++) {
    let strategy = eventStrategies[i];
    customStrategies.push(strategy.toHexString());
  }

  agreement.customStrategies = customStrategies;
  agreement.allowedStrategies = parseAllowed(event.params.allowedStrategies);
  agreement.save();
}

export function handleParamsSet(event: ParamsSet): void {
  let id = event.address.toHexString();
  let agreement = AgreementEntity.load(id);
  agreement.maxSlippage = event.params.maxSwapSlippage;
  agreement.save();

  let portfolio = PortfolioEntity.load(id) || new PortfolioEntity(id);
  portfolio.depositFee = event.params.depositFee;
  portfolio.withdrawFee = event.params.withdrawFee;
  portfolio.performanceFee = event.params.performanceFee;
  portfolio.feeCollector = event.params.feeCollector;
  portfolio.save();
}

export function loadOrCreateAgreement(
  address: Address,
  version: string = ""
): AgreementEntity {
  let id = address.toHexString();
  let agreement = AgreementEntity.load(id);

  if (agreement === null) {
    agreement = new AgreementEntity(id);
    agreement.portfolio = id;
    agreement.name = "";
    agreement.version = version;
    agreement.maxSlippage = BigInt.fromI32(0);
    agreement.managers = [];
    agreement.withdrawers = [];
    agreement.customTokens = [];
    agreement.allowedTokens = "Custom";
    agreement.customStrategies = [];
    agreement.allowedStrategies = "Custom";
    agreement.save();
  }

  return agreement!;
}

function loadOrCreateManager(managerAddress: Address): ManagerEntity {
  let id = managerAddress.toHexString();
  let manager = ManagerEntity.load(id);

  if (manager === null) {
    manager = new ManagerEntity(id);
    manager.save();
  }

  return manager!;
}

function parseAllowed(allowedStrategies: BigInt): string {
  if (allowedStrategies.equals(BigInt.fromI32(0))) return "OnlyCustom";
  if (allowedStrategies.equals(BigInt.fromI32(1)))
    return "CustomAndWhitelisted";
  if (allowedStrategies.equals(BigInt.fromI32(2))) return "Any";
  return "unknown";
}
