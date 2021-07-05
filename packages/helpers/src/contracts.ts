import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'

import { getSigner } from './signers'

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function deploy(name: string, args: Array<any> = [], from?: SignerWithAddress): Promise<Contract> {
  if (!args) args = []
  if (!from) from = await getSigner()

  const { ethers } = await import('hardhat')
  const factory = await ethers.getContractFactory(name)
  const instance = await factory.connect(from).deploy(...args)
  return instance.deployed()
}

export async function contractAt(name: string, address: string): Promise<Contract> {
  const { ethers } = await import('hardhat')
  return ethers.getContractAt(name, address)
}
