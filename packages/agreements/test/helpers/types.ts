import { BigNumberish } from '@mimic-fi/v1-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'

export type NAry<T> = T | Array<T>

export type Account = string | { address: string }

export type TxParams = {
  from?: SignerWithAddress
}

export type Allowed = 'onlyCustom' | 'customAndWhitelisted' | 'any'

export type RawAgreementDeployment = {
  weth?: Contract
  vault?: Contract
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
  weth: Contract
  vault: Contract
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

export function toAddress(account: Account): string {
  return typeof account === 'string' ? account : account.address
}

export function toAddresses(accounts: Account[]): string[] {
  return accounts.map(toAddress)
}
