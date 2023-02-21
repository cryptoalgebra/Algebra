import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import 'hardhat-watcher';
import 'hardhat-dependency-compiler';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import 'algebra-solidity-docgen';
import baseConfig from '../../hardhat.base.config';

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.8.17',
  settings: {
    optimizer: {
      enabled: true,
      runs: 2_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const LOWEST_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.8.17',
  settings: {
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 1_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.8.17',
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

export default {
  networks: baseConfig.networks,
  etherscan: baseConfig.etherscan,
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/NonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/LimitOrderManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/MockTimeNonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/NFTDescriptorTest.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/NonfungibleTokenPositionDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/NFTDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/NFTSVG.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
    },
  },
  typechain: {
    outDir: 'typechain'
  },
  docgen: {
    output: '../../docs/Contracts/Periphery',
    pages: (x: any) => x.name.toString() + '.md',
    templates: '../../docs/doc_templates/public'
  },
  dependencyCompiler: {
    paths: [
      '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol',
    ],
  }
}
