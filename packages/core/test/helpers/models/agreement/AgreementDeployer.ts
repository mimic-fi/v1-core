import { deploy, fp, getSigners } from '@mimic-fi/v1-helpers'

import { toAddress, toAddresses } from '../types'
import { AgreementDeployment, RawAgreementDeployment } from './types'

import Vault from '../vault/Vault'
import Agreement from './Agreement'

const ALLOWED_STRATEGIES = {
  any: 0,
  none: 1,
  whitelisted: 2,
}

const AgreementDeployer = {
  async deploy(params: RawAgreementDeployment = {}): Promise<Agreement> {
    const parsedParams = await this.parseParams(params)
    const { vault, feeCollector, depositFee, withdrawFee, performanceFee, maxSwapSlippage, managers, withdrawers, tokens, allowedTokens, strategies, allowedStrategies } = parsedParams

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

    return new Agreement(agreement, vault, feeCollector, depositFee, withdrawFee, performanceFee, maxSwapSlippage, managers, withdrawers, tokens, allowedTokens, strategies, allowedStrategies)
  },

  async parseParams(params: RawAgreementDeployment): Promise<AgreementDeployment> {
    const [, signer1, signer2, signer3, signer4, signer5] = await getSigners()

    const vault = params.vault && params.vault !== 'mocked' ? params.vault : await Vault.create({ mocked: !!params.vault })
    const feeCollector = params.feeCollector ?? signer5
    const depositFee = params.depositFee ?? 0
    const withdrawFee = params.withdrawFee ?? 0
    const performanceFee = params.performanceFee ?? 0
    const maxSwapSlippage = params.maxSwapSlippage ?? fp(0.02)

    const managers = params.managers || [signer3, signer4]
    const withdrawers = params.withdrawers || [signer1, signer2]

    const tokens = params.tokens ?? []
    const allowedTokens = params.allowedTokens ?? 'any'

    const strategies = params.strategies ?? []
    const allowedStrategies = params.allowedStrategies ?? 'any'
    return { vault, feeCollector, depositFee, withdrawFee, performanceFee, maxSwapSlippage, managers, withdrawers, tokens, allowedTokens, strategies, allowedStrategies }
  },
}

export default AgreementDeployer
