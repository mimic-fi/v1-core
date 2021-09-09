import path from 'path'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-local-networks-config-plugin'

import { task } from 'hardhat/config'
import { homedir } from 'os'
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names'
import { overrideFunctions } from '@mimic-fi/v1-helpers'

task(TASK_COMPILE).setAction(overrideFunctions(['query']))

export default {
  localNetworksConfig: path.join(homedir(), '/.hardhat/networks.mimic.json'),
  solidity: {
    version: '0.8.0',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
}
