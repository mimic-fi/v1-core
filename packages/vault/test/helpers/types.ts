import { BigNumberish } from '@mimic-fi/v1-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'

export type NAry<T> = T | Array<T>

export type Account = string | { address: string }

export type TxParams = {
  from?: SignerWithAddress
}

export type RawVaultDeployment = {
  mocked?: boolean
  protocolFee?: BigNumberish
  priceOracle?: Contract
  swapConnector?: Contract
  tokens?: Contract[]
  strategies?: Contract[]
  from?: SignerWithAddress
}

export type VaultDeployment = {
  mocked: boolean
  protocolFee: BigNumberish
  priceOracle: Contract
  swapConnector: Contract
  tokens: Contract[]
  strategies: Contract[]
  admin: SignerWithAddress
}

export function toAddress(account: Account): string {
  return typeof account === 'string' ? account : account.address
}

export function toAddresses(accounts: Account[]): string[] {
  return accounts.map(toAddress)
}
