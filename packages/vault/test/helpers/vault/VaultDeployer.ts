import { deploy, fp, getSigner } from '@mimic-fi/v1-helpers'

import { RawVaultDeployment, toAddresses, VaultDeployment } from '../types'
import Vault from './Vault'

const VaultDeployer = {
  async deploy(params: RawVaultDeployment = {}): Promise<Vault> {
    const parsedParams = await this.parseParams(params)
    const { maxSlippage, protocolFee, priceOracle, swapConnector, tokens, strategies, admin } = parsedParams
    const vault = await deploy(
      'Vault',
      [
        maxSlippage,
        protocolFee,
        priceOracle.address,
        swapConnector.address,
        toAddresses(tokens),
        toAddresses(strategies),
      ],
      admin
    )
    return new Vault(vault, maxSlippage, protocolFee, priceOracle, swapConnector, tokens, strategies, admin)
  },

  async parseParams(params: RawVaultDeployment): Promise<VaultDeployment> {
    const mocked = params.mocked ?? false
    const maxSlippage = params.maxSlippage ?? fp(20)
    const protocolFee = params.protocolFee ?? 0
    const priceOracle = params.priceOracle ?? (await deploy('PriceOracleMock'))
    const swapConnector = params.swapConnector ?? (await deploy('SwapConnectorMock'))
    const tokens = params.tokens ?? []
    const strategies = params.strategies ?? []
    const admin = params.from ?? (await getSigner())
    return { mocked, maxSlippage, protocolFee, priceOracle, swapConnector, tokens, strategies, admin }
  },
}

export default VaultDeployer
