import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'

export async function getSigner(index = 0): Promise<SignerWithAddress> {
  const signers = await getSigners()
  return signers[index]
}

export async function getSigners(size?: number): Promise<SignerWithAddress[]> {
  const { ethers } = await import('hardhat')
  const signers = await ethers.getSigners()
  return size ? signers.slice(0, size) : signers
}
