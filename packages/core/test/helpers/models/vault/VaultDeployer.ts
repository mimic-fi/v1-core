import { deploy, getSigner } from '@mimic-fi/v1-helpers'

import Vault from './Vault'
import { RawVaultDeployment, VaultDeployment } from './type'

const VaultDeployer = {
  async deploy(params: RawVaultDeployment = {}): Promise<Vault> {
    const { mocked, priceOracle, swapConnector, protocolFee, strategies, admin } = await this.parseParams(params)
    const vault = await deploy(mocked ? 'VaultMock' : 'Vault', [protocolFee, priceOracle.address, swapConnector.address, strategies.map((s) => s.address)], admin)
    return new Vault(vault, priceOracle, swapConnector, protocolFee, strategies, admin)
  },

  async parseParams(params: RawVaultDeployment): Promise<VaultDeployment> {
    const mocked = params.mocked ?? false
    const priceOracle = params.priceOracle ?? (await deploy('PriceOracleMock'))
    const swapConnector = params.swapConnector ?? (await deploy('SwapConnectorMock'))
    const protocolFee = params.protocolFee ?? 0
    const strategies = params.strategies ?? []
    const admin = params.from ?? (await getSigner())
    return { mocked, priceOracle, swapConnector, protocolFee, strategies, admin }
  },
}

export default VaultDeployer
