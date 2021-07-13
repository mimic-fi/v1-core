import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'

import { getSigner } from './signers'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export async function deploy(nameOrAbi: string | { abi: any; bytecode: string }, args: Array<any> = [], from?: SignerWithAddress): Promise<Contract> {
  if (!args) args = []
  if (!from) from = await getSigner()

  const { ethers } = await import('hardhat')
  const factory = typeof nameOrAbi === 'string' ? await ethers.getContractFactory(nameOrAbi) : await ethers.getContractFactory(nameOrAbi.abi, nameOrAbi.bytecode)
  const instance = await factory.connect(from).deploy(...args)
  return instance.deployed()
}

export async function instanceAt(nameOrAbi: string | any, address: string): Promise<Contract> {
  const { ethers } = await import('hardhat')
  return ethers.getContractAt(nameOrAbi, address)
}
