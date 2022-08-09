import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-watcher'
import 'solidity-coverage'
import 'algebra-solidity-docgen'
import 'hardhat-contract-sizer'
import baseConfig from '../../hardhat.base.config';

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 2_000,
      details: {
        yul: true,
        yulDetails: {
          stackAllocation: true,
          optimizerSteps: "dhfoDgvulfnTUtnIf"
        }
      }
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const LOWEST_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 1_000,
      details: {
        yul: true,
        yulDetails: {
          stackAllocation: true,
          optimizerSteps: "dhfoDgvulfnTUtnIf"
        }
      }
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 1_000_000,
      details: {
        yul: true,
        yulDetails: {
          stackAllocation: true,
          optimizerSteps: "dhfoDgvulfnTUtnIf"
        }
      }
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const ZERO_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    optimizer: {
      enabled: true,
      runs: 800,
      details: {
        yul: true,
        yulDetails: {
          stackAllocation: true,
          optimizerSteps: "dhfoDgvulfnTUtnIf"
        }
      }
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

export default {
  networks: baseConfig.networks,
  etherscan: baseConfig.etherscan,
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/NonfungiblePositionManager.sol': ZERO_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/MockTimeNonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/NFTDescriptorTest.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/NonfungibleTokenPositionDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/NFTDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/NFTSVG.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/Strings.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS
    },
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: true,
    runOnCompile: false
  },
  watcher: {
    test: {
      tasks: [{ command: 'test', params: { testFiles: ['{path}'] } }],
      files: ['./test/**/*'],
      verbose: true,
    },
  },
  docgen: {
    output: '../../docs/Contracts/Periphery',
    pages: (x: any) => x.name.toString() + '.md',
    templates: '../../docs/doc_templates/public'
  }
}
