import { getArtifact } from '@mimic-fi/v1-helpers'

import ARTIFACTS from './artifacts'

async function benchmark(): Promise<void> {
  const Vault = await getArtifact(ARTIFACTS.vault)
  const Agreement = await getArtifact(ARTIFACTS.agreement)
  const AgreementFactory = await getArtifact(ARTIFACTS.agreementFactory)

  console.log(`- Vault: ${Vault.deployedBytecode.length / 2} bytes`)
  console.log(`- Agreement: ${Agreement.deployedBytecode.length / 2} bytes`)
  console.log(`- AgreementFactory: ${AgreementFactory.deployedBytecode.length / 2} bytes`)
}

benchmark().catch(console.error)
