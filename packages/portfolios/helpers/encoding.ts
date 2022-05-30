import { defaultAbiCoder } from '@ethersproject/abi'
import { BigNumber } from 'ethers'

export const PORTFOLIOS_DATA_TYPE = {
  None: 0,
  Withdrawer: 1,
  Slippage: 2,
}

export function encodeWithdrawer(withdrawer: string): string {
  return defaultAbiCoder.encode(['uint8', 'address'], [PORTFOLIOS_DATA_TYPE.Withdrawer, withdrawer])
}

export function encodeSlippage(slippage: BigNumber): string {
  return defaultAbiCoder.encode(['uint8', 'uint256'], [PORTFOLIOS_DATA_TYPE.Slippage, slippage.toString()])
}
