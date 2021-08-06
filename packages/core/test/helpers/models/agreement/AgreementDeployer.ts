import { deploy, getSigners } from '@mimic-fi/v1-helpers'

import Vault from '../vault/Vault'
import Agreement from './Agreement'
import { toAddress, toAddresses } from '../types'
import { AgreementDeployment, RawAgreementDeployment } from './types'

const ALLOWED_STRATEGIES = {
  any: 0,
  none: 1,
  whitelisted: 2,
}

const AgreementDeployer = {
  async deploy(params: RawAgreementDeployment = {}): Promise<Agreement> {
    const { name, vault, depositFee, performanceFee, feeCollector, managers, withdrawers, allowedStrategies, strategies } = await this.parseParams(params)

    const agreement = await deploy(
      'Agreement',
      [name, vault.address, depositFee, performanceFee, toAddress(feeCollector), toAddresses(managers), toAddresses(withdrawers), ALLOWED_STRATEGIES[allowedStrategies], toAddresses(strategies)],
      params.from
    )

    return new Agreement(agreement, name, vault, depositFee, performanceFee, feeCollector, managers, withdrawers, allowedStrategies, strategies)
  },

  async parseParams(params: RawAgreementDeployment): Promise<AgreementDeployment> {
    const [, signer1, signer2, signer3, signer4, signer5] = await getSigners()

    const vault = params.vault && params.vault !== 'mocked' ? params.vault : await Vault.create({ mocked: !!params.vault })
    const name = params.name ?? 'Test Agreement'
    const depositFee = params.depositFee ?? 0
    const performanceFee = params.performanceFee ?? 0
    const feeCollector = params.feeCollector ?? signer5

    if (!params.managers) params.managers = []
    const managers = [params.managers[0] ?? signer3, params.managers[1] ?? signer4]

    if (!params.withdrawers) params.withdrawers = []
    const withdrawers = [params.withdrawers[0] ?? signer1, params.withdrawers[1] ?? signer2]

    const allowedStrategies = params.allowedStrategies ?? 'any'
    const strategies = params.strategies ?? []
    return { name, vault, depositFee, performanceFee, feeCollector, managers, withdrawers, allowedStrategies, strategies }
  },
}

export default AgreementDeployer
