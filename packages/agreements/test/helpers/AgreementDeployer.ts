import { deploy, fp, getSigners } from '@mimic-fi/v1-helpers'

import Agreement from './Agreement'
import { AgreementDeployment, RawAgreementDeployment, toAddress, toAddresses } from './types'

const ALLOWED_STRATEGIES = {
  onlyCustom: 0,
  customAndWhitelisted: 1,
  any: 2,
}

const AgreementDeployer = {
  async deploy(params: RawAgreementDeployment = {}): Promise<Agreement> {
    const parsedParams = await this.parseParams(params)
    const {
      vault,
      feeCollector,
      depositFee,
      withdrawFee,
      performanceFee,
      maxSwapSlippage,
      managers,
      withdrawers,
      tokens,
      allowedTokens,
      strategies,
      allowedStrategies,
    } = parsedParams

    const agreement = await deploy('Agreement', [], params.from)
    await agreement.initialize(
      vault.address,
      toAddress(feeCollector),
      depositFee,
      withdrawFee,
      performanceFee,
      maxSwapSlippage,
      toAddresses(managers),
      toAddresses(withdrawers),
      toAddresses(tokens),
      ALLOWED_STRATEGIES[allowedTokens],
      toAddresses(strategies),
      ALLOWED_STRATEGIES[allowedStrategies]
    )

    return new Agreement(
      agreement,
      vault,
      feeCollector,
      depositFee,
      withdrawFee,
      performanceFee,
      maxSwapSlippage,
      managers,
      withdrawers,
      tokens,
      allowedTokens,
      strategies,
      allowedStrategies
    )
  },

  async parseParams(params: RawAgreementDeployment): Promise<AgreementDeployment> {
    const [, signer1, signer2, signer3, signer4, signer5, signer6] = await getSigners()

    const vault = params.vault || (await deploy('VaultMock'))
    const feeCollector = params.feeCollector ?? signer6
    const depositFee = params.depositFee ?? 0
    const withdrawFee = params.withdrawFee ?? 0
    const performanceFee = params.performanceFee ?? 0
    const maxSwapSlippage = params.maxSwapSlippage ?? fp(0.01)

    const managers = params.managers || [signer3, signer4, signer5]
    const withdrawers = params.withdrawers || [signer1, signer2, signer5]

    const tokens = params.tokens ?? []
    const allowedTokens = params.allowedTokens ?? 'any'

    const strategies = params.strategies ?? []
    const allowedStrategies = params.allowedStrategies ?? 'any'
    return {
      vault,
      feeCollector,
      depositFee,
      withdrawFee,
      performanceFee,
      maxSwapSlippage,
      managers,
      withdrawers,
      tokens,
      allowedTokens,
      strategies,
      allowedStrategies,
    }
  },
}

export default AgreementDeployer
