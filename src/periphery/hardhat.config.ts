import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@matterlabs/hardhat-zksync-upgradable";
import baseConfig from '../../hardhat.base.config';

module.exports = {
  zksolc: {
    version: "1.3.8",
    compilerSource: "binary",
    settings: {}
  },
  defaultNetwork: "zkSyncTestnet",
  networks: baseConfig.networks,
  solidity: {
    version: "0.8.17",
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      libraries: {
        "contracts/libraries/NFTDescriptor.sol": {
          NFTDescriptor: "0x38eB2440186a8e43FB1E313DE5ca9CB74Ce266d6",
        },
      },
    }
  },
};