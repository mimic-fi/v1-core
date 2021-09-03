import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { BigNumberish } from '@mimic-fi/v1-helpers'

import Vault from '../vault/Vault'
import { Account } from '../types'

export type Allowed = 'any' | 'whitelisted' | 'none'

export type RawAgreementDeployment = {
  vault?: Vault | 'mocked'
  depositFee?: BigNumberish
  withdrawFee?: BigNumberish
  performanceFee?: BigNumberish
  feeCollector?: Account
  maxSwapSlippage?: BigNumberish
  managers?: Account[]
  withdrawers?: Account[]
  allowedTokens?: Allowed
  tokens?: Contract[]
  allowedStrategies?: Allowed
  strategies?: Contract[]
  from?: SignerWithAddress
}

export type AgreementDeployment = {
  vault: Vault
  depositFee: BigNumberish
  withdrawFee: BigNumberish
  performanceFee: BigNumberish
  feeCollector: Account
  maxSwapSlippage: BigNumberish
  managers: Account[]
  withdrawers: Account[]
  allowedTokens: Allowed
  tokens: Contract[]
  allowedStrategies: Allowed
  strategies: Contract[]
  from?: SignerWithAddress
}
