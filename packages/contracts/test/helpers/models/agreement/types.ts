import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { BigNumberish } from '@mimic-fi/v1-helpers'

import Vault from '../vault/Vault'
import { Account } from '../types'

export type AllowedStrategies = 'any' | 'whitelisted' | 'none'

export type RawAgreementDeployment = {
  name?: string
  vault?: Vault | 'mocked'
  feeCollector?: Account
  depositFee?: BigNumberish
  performanceFee?: BigNumberish
  managers?: Account[]
  withdrawers?: Account[]
  allowedStrategies?: AllowedStrategies
  strategies?: Contract[]
  from?: SignerWithAddress
}

export type AgreementDeployment = {
  name: string
  vault: Vault
  feeCollector: Account
  depositFee: BigNumberish
  performanceFee: BigNumberish
  managers: Account[]
  withdrawers: Account[]
  allowedStrategies: AllowedStrategies
  strategies: Contract[]
  from?: SignerWithAddress
}
