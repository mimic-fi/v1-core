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
    const { vault, feeCollector, depositFee, performanceFee, maxSwapSlippage, managers, withdrawers, strategies, allowedStrategies } = await this.parseParams(params)

    const agreement = await deploy(
      'Agreement',
      [
        vault.address,
        toAddress(feeCollector),
        depositFee,
        performanceFee,
        maxSwapSlippage,
        toAddresses(managers),
        toAddresses(withdrawers),
        toAddresses(strategies),
        ALLOWED_STRATEGIES[allowedStrategies],
      ],
      params.from
    )

    return new Agreement(agreement, vault, feeCollector, depositFee, performanceFee, maxSwapSlippage, managers, withdrawers, strategies, allowedStrategies)
  },

  async parseParams(params: RawAgreementDeployment): Promise<AgreementDeployment> {
    const [, signer1, signer2, signer3, signer4, signer5] = await getSigners()

    const vault = params.vault && params.vault !== 'mocked' ? params.vault : await Vault.create({ mocked: !!params.vault })
    const feeCollector = params.feeCollector ?? signer5
    const depositFee = params.depositFee ?? 0
    const performanceFee = params.performanceFee ?? 0
    const maxSwapSlippage = params.maxSwapSlippage ?? fp(0.02)

    const managers = params.managers || [signer3, signer4]
    const withdrawers = params.withdrawers || [signer1, signer2]

    const strategies = params.strategies ?? []
    const allowedStrategies = params.allowedStrategies ?? 'any'
    return { vault, feeCollector, depositFee, performanceFee, maxSwapSlippage, managers, withdrawers, strategies, allowedStrategies }
  },
}

export default AgreementDeployer
