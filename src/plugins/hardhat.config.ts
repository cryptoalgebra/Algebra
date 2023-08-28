import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import baseConfig from '../../hardhat.base.config';

module.exports = {
  zksolc: {
    version: "1.3.13",
    compilerSource: "binary",
    settings: {}
  },
  defaultNetwork: "zkSyncTestnet",
  networks: baseConfig.networks,
  solidity: {
    version: "0.8.20",
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
    }
  },
};
