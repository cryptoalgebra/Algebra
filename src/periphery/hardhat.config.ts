import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-output-validator';
import 'hardhat-contract-sizer';
import 'solidity-docgen';
import baseConfig from '../../hardhat.base.config';
import { task } from 'hardhat/config';

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.8.20',
  settings: {
    evmVersion: 'paris',
    optimizer: {
      enabled: true,
      runs: 2_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};

const LOWEST_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.8.20',
  settings: {
    evmVersion: 'paris',
    viaIR: true,
    optimizer: {
      enabled: true,
      runs: 1_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
};

const DEFAULT_COMPILER_SETTINGS = {
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

task('expand-abi', 'adds pool custom errors to abi', async (taskArgs, hre) => {
  const poolArtifact = await hre.artifacts.readArtifact('IAlgebraPool');

  const routerArtifact = await hre.artifacts.readArtifact('SwapRouter');
  const positionManagerArtifact = await hre.artifacts.readArtifact('NonfungiblePositionManager');

  const poolErrors = poolArtifact.abi.filter((x) => x.type == 'error');

  routerArtifact.abi = routerArtifact.abi.concat(poolErrors);
  positionManagerArtifact.abi = positionManagerArtifact.abi.concat(poolErrors);

  await hre.artifacts.saveArtifactAndDebugFile(routerArtifact);
  await hre.artifacts.saveArtifactAndDebugFile(positionManagerArtifact);
});

export default {
  networks: baseConfig.networks,
  etherscan: baseConfig.etherscan,
  solidity: {
    compilers: [DEFAULT_COMPILER_SETTINGS],
    overrides: {
      'contracts/NonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/MockTimeNonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/test/NFTDescriptorTest.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/NonfungibleTokenPositionDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/NFTDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/NFTSVG.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
    },
  },
  typechain: {
    outDir: 'typechain',
  },
  docgen: {
    outputDir: '../../docs/Contracts/Periphery',
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
