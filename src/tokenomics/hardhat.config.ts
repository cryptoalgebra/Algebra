import '@typechain/hardhat'
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer'
import 'solidity-docgen'

import { HardhatUserConfig } from 'hardhat/config'
import { SolcUserConfig } from 'hardhat/types'

import baseConfig from '../../hardhat.base.config'

const DEFAULT_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.20',
  settings: {
    evmVersion: 'paris',
    optimizer: {
      enabled: true,
      runs: 99999999,
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
  },
  typechain: {
    outDir: 'typechain',
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: true,
    runOnCompile: false,
  },
  docgen: {
    outputDir: '../../docs/Contracts/Tokenomics',
    pages: (x: any) => x.name.toString() + '.md',
    templates: '../../docs/doc_templates/public',
    collapseNewlines: true
  },
}

export default config
