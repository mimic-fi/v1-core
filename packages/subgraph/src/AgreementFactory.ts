import { BigInt } from "@graphprotocol/graph-ts";

import { Agreement } from "../types/templates";
import { AgreementCreated } from "../types/AgreementFactoryV1/AgreementFactory";

import { loadOrCreateAgreement } from "./Agreement";

export function handleCreateV1(event: AgreementCreated): void {
  handleCreate(event, "1.0.0");
}

export function handleCreateV2(event: AgreementCreated): void {
  handleCreate(event, "2.0.0");
}

function handleCreate(event: AgreementCreated, version: string): void {
  Agreement.create(event.params.agreement);
  let agreement = loadOrCreateAgreement(event.params.agreement, version);
  agreement.name = event.params.name;
  agreement.save();
}
