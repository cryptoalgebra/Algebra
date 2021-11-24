import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-contract-sizer'
import 'solidity-coverage'

import { HardhatUserConfig } from 'hardhat/config'
import { SolcUserConfig } from 'hardhat/types'

import baseConfig from "../../hardhat.base.config";

const DEFAULT_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 0,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const COMPILER_SETTINGS_084 = {
  version: '0.8.4',
  settings: {
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const config: HardhatUserConfig = {
  networks: baseConfig.networks,
  etherscan: baseConfig.etherscan,
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/AlgebraVault.sol': COMPILER_SETTINGS_084,
    }
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: true,
    runOnCompile: false,
  },
}

export default config
