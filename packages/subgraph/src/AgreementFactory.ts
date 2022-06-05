import { Agreement } from '../types/templates'
import { AgreementCreated } from '../types/AgreementFactoryV1/AgreementFactory'

import { loadOrCreateAgreement } from './Agreement'

export function handleCreate(event: AgreementCreated): void {
  Agreement.create(event.params.agreement)
  let agreement = loadOrCreateAgreement(event.params.agreement)
  agreement.name = event.params.name
  agreement.save()
}
