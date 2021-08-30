import { getArtifact } from '@mimic-fi/v1-helpers'

async function benchmark(): Promise<void> {
  const Vault = await getArtifact('Vault')
  const Agreement = await getArtifact('Agreement')
  const AgreementFactory = await getArtifact('AgreementFactory')

  console.log(`- Vault: ${Vault.deployedBytecode.length / 2} bytes`)
  console.log(`- Agreement: ${Agreement.deployedBytecode.length / 2} bytes`)
  console.log(`- AgreementFactory: ${AgreementFactory.deployedBytecode.length / 2} bytes`)
}

benchmark().then().catch(console.error)
