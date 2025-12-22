import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import type { HardhatUserConfig } from "hardhat/config";
import path from "path";

const env = require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { MNEMONIC, ETHERSCAN_API_KEY } =
  env.parsed || {};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 0
      }
    }
  },
  typechain: {
    outDir: "types",
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    baseTestnet: {
      url: `https://base-sepolia.gateway.tenderly.co`,
      chainId: 84532,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    base: {
      url: `https://1rpc.io/base`,
      chainId: 8453,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    hyper: {
      url: `https://rpc.hypurrscan.io`,
      chainId: 999,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    }
  },
  etherscan: {
    apiKey: {
      base: ETHERSCAN_API_KEY,
      baseTestnet: ETHERSCAN_API_KEY,
      hyper: ETHERSCAN_API_KEY
    },
    customChains: [
      {
        network: 'baseTestnet',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org/',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org/',
        },
      },
      {
        network: 'hyper',
        chainId: 999,
        urls: {
          apiURL: 'https://www.hyperscan.com/api',
          browserURL: 'https://www.hyperscan.com/',
        },
      }
    ]
  }
};

export default config;
