import { getArtifact } from '@mimic-fi/v1-helpers'

async function benchmark(): Promise<void> {
  const Vault = await getArtifact('@mimic-fi/v1-core/artifacts/contracts/Vault.sol/Vault')
  const Agreement = await getArtifact('@mimic-fi/v1-agreements/artifacts/contracts/Agreement.sol/Agreement')
  const AgreementFactory = await getArtifact('@mimic-fi/v1-agreements/artifacts/contracts/AgreementFactory.sol/AgreementFactory')

  console.log(`- Vault: ${Vault.deployedBytecode.length / 2} bytes`)
  console.log(`- Agreement: ${Agreement.deployedBytecode.length / 2} bytes`)
  console.log(`- AgreementFactory: ${AgreementFactory.deployedBytecode.length / 2} bytes`)
}

benchmark().then().catch(console.error)
