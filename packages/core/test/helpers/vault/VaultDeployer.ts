import { deploy, getSigner } from '@mimic-fi/v1-helpers'

import { toAddresses, RawVaultDeployment, VaultDeployment } from '../types'

import Vault from './Vault'

const VaultDeployer = {
  async deploy(params: RawVaultDeployment = {}): Promise<Vault> {
    const { priceOracle, swapConnector, protocolFee, tokens, strategies, admin } = await this.parseParams(params)
    const vault = await deploy('Vault', [protocolFee, priceOracle.address, swapConnector.address, toAddresses(tokens), toAddresses(strategies)], admin)
    return new Vault(vault, priceOracle, swapConnector, protocolFee, tokens, strategies, admin)
  },

  async parseParams(params: RawVaultDeployment): Promise<VaultDeployment> {
    const mocked = params.mocked ?? false
    const priceOracle = params.priceOracle ?? (await deploy('PriceOracleMock'))
    const swapConnector = params.swapConnector ?? (await deploy('SwapConnectorMock'))
    const protocolFee = params.protocolFee ?? 0
    const tokens = params.tokens ?? []
    const strategies = params.strategies ?? []
    const admin = params.from ?? (await getSigner())
    return { mocked, priceOracle, swapConnector, protocolFee, tokens, strategies, admin }
  },
}

export default VaultDeployer
