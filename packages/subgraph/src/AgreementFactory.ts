import { Agreement } from '../types/templates'
import { AgreementCreated as AgreementCreatedV1 } from '../types/AgreementFactoryV1/AgreementFactory'
import { AgreementCreated as AgreementCreatedV2 } from '../types/AgreementFactoryV2/AgreementFactory'

import { loadOrCreateAgreement } from './Agreement'

export function handleCreateV1(event: AgreementCreatedV1): void {
  Agreement.create(event.params.agreement)
  let agreement = loadOrCreateAgreement(event.params.agreement, 'v1_0_0')
  agreement.name = event.params.name
  agreement.save()
}

export function handleCreateV2(event: AgreementCreatedV2): void {
  Agreement.create(event.params.agreement)
  let agreement = loadOrCreateAgreement(event.params.agreement, 'v2_0_0')
  agreement.name = event.params.name
  agreement.save()
}
