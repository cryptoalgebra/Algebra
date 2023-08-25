import '@typechain/hardhat'
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-output-validator';
import 'hardhat-contract-sizer'
import 'hardhat-dependency-compiler';
import 'solidity-docgen'

import { HardhatUserConfig } from 'hardhat/config'
import { SolcUserConfig } from 'hardhat/types'

import baseConfig from '../../hardhat.base.config'

const DEFAULT_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.20',
  settings: {
    evmVersion: 'london',
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
  dependencyCompiler: {
    paths: [
      '@cryptoalgebra/plugins/contracts/BasePluginV1Factory.sol',
    ],
  },
  docgen: {
    outputDir: '../../docs/Contracts/Farmings',
    pages: (x: any) => {
      if (x.name.toString().match(/^I[A-Z]/)) return `interfaces/${x.name.toString()}.md`;
      if (x.abstract) return `base/${x.name.toString()}.md`;
      return x.name.toString() + '.md';
    },
    templates: '../../docs/doc_templates/public',
    collapseNewlines: true
  },
  outputValidator: {
    runOnCompile: false,
    exclude: ['contracts/test'],
  },
}

export default config
