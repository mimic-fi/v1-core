import { Agreement } from '../types/templates'
import { AgreementCreated } from '../types/AgreementFactory/AgreementFactory'

export function handleCreate(event: AgreementCreated): void {
  Agreement.create(event.params.agreement)
}
