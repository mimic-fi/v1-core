import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export type NAry<T> = T | Array<T>

export type Account = string | { address: string }

export type TxParams = {
  from?: SignerWithAddress
}

export function toAddress(account: Account): string {
  return typeof account === 'string' ? account : account.address
}

export function toAddresses(accounts: Account[]): string[] {
  return accounts.map(toAddress)
}
