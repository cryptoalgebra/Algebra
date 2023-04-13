import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";

module.exports = {
  zksolc: {
    version: "1.3.8",
    compilerSource: "binary",
    settings: {}
  },
  defaultNetwork: "zkSyncTestnet",

  networks: {
    zkSyncTestnet: {
      url: "https://testnet.era.zksync.dev",
      ethNetwork: "goerli", // RPC URL of the network (e.g. https://goerli.infura.io/v3/<API_KEY>)
      gasPrice: 100_000_000,
      verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification',
      zksync: true,
    },
  },
  solidity: {
    version: "0.8.17",
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
    }
  },
};