import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-output-validator';
import 'hardhat-contract-sizer';
import 'solidity-docgen';
import { SolcUserConfig } from 'hardhat/types';
import baseConfig from '../../hardhat.base.config';

const HIGHEST_OPTIMIZER_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.20',
  settings: {
    evmVersion: 'paris',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};

const DEFAULT_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.20',
  settings: {
    evmVersion: 'paris',
    optimizer: {
      enabled: true,
      runs: 200,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};

const LOWEST_COMPILER_SETTINGS: SolcUserConfig = {
  version: '0.8.20',
  settings: {
    evmVersion: 'paris',
    optimizer: {
      enabled: true,
      runs: 0,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};

if (process.env.RUN_COVERAGE == '1') {
  /**
   * Updates the default compiler settings when running coverage.
   *
   * See https://github.com/sc-forks/solidity-coverage/issues/417#issuecomment-730526466
   */
  console.info('Using coverage compiler settings');
  const details = {
    yul: true,
    yulDetails: {
      stackAllocation: true,
    },
  };

  HIGHEST_OPTIMIZER_COMPILER_SETTINGS.settings.details = details;
  DEFAULT_COMPILER_SETTINGS.settings.details = details;
}

export default {
  networks: baseConfig.networks,
  etherscan: baseConfig.etherscan,
  typechain: {
    outDir: 'typechain',
  },
  solidity: {
    compilers: [HIGHEST_OPTIMIZER_COMPILER_SETTINGS],
  },
  docgen: {
    outputDir: '../../docs/Contracts/Plugin',
    pages: (x: any, buildInfo: any) => {
      return `${buildInfo.relativePath}`.replace('.sol', '.md');
    },
    templates: '../../docs/doc_templates/public',
    collapseNewlines: true,
  },
  outputValidator: {
    runOnCompile: false,
    exclude: ['contracts/test'],
  },
};
