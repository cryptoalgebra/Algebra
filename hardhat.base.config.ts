const path = require('path');
const config = require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { ZETACHAIN_BLOCKSOUT_API_KEY, TAIKOSCAN_API_KEY, POLYGONSCAN_API_KEY, MNEMONIC, DEPLOY_GAS_LIMIT_MAX, DEPLOY_GAS_PRICE, INFURA_ID_PROJECT } =
  config.parsed || {};

export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      loggingEnabled: false,
      evm: 'paris',
    },
    localHardhat: {
      url: `http://127.0.0.1:8545`,
      accounts: ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'],
    },
    localGeth: {
      url: `http://127.0.0.1:8545`,
      chainId: 1337,
      gas: 10000000,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_ID_PROJECT}`,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_ID_PROJECT}`,
      chainId: 3,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_ID_PROJECT}`,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_ID_PROJECT}`,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_ID_PROJECT}`,
      chainId: 42,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
      gasPrice: 8000000000,
    },
    sepolia: {
      url: `https://rpc2.sepolia.org`,
      chainId: 11155111,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    scrollSepolia: {
      url: `https://scroll-testnet-public.unifra.io`,
      chainId: 534351,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    hekla: {
      url: `https://rpc.hekla.taiko.xyz`,
      chainId: 167009,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    taiko: {
      url: `https://taiko.blockpi.network/v1/rpc/public`,
      chainId: 167000,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    bscTestnet: {
      url: `https://data-seed-prebsc-2-s3.binance.org:8545`,
      chainId: 97,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    bsc: {
      url: `https://bsc-dataseed3.binance.org`,
    },
    mumbai: {
      url: `https://polygon-mumbai-bor.publicnode.com`,
      chainId: 80001,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    mantleTestnet: {
      url: `https://rpc.testnet.mantle.xyz`,
      chainId: 5001,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    mantle: {
      url: `https://rpc.mantle.xyz`,
      chainId: 5000,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    seiTestnet: {
      url: `https://evm-rpc.arctic-1.seinetwork.io`,
      chainId: 713715,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    mode: {
      url: `https://mainnet.mode.network/`,
      chainId: 34443,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    blastTestnet: {
      url: `https://blast-sepolia.blockpi.network/v1/rpc/public`,
      chainId: 168587773,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    telosTestnet: {
      url: `https://testnet.telos.net/evm`,
      chainId: 41,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    beraTestnet: {
      url: `https://artio.rpc.berachain.com/`,
      chainId: 80085,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    maticMainnet: {
      url: `https://rpc-mainnet.matic.quiknode.pro`,
      chainId: 137,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
      gasPrice: 50_000_000_000,
    },
    artheraTestnet: {
      url: `https://rpc-test.arthera.net`,
      chainId: 10243,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    baseMainnet: {
      url: `https://base.llamarpc.com`,
      chainId: 8453,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    baseSepolia: {
      url: `https://base-sepolia.blockpi.network/v1/rpc/public`,
      chainId: 84532,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    },
    zetachain: {
      url: `https://zetachain-mainnet.public.blastapi.io`,
      chainId: 7000,
      accounts: [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`],
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: `${ZETACHAIN_BLOCKSOUT_API_KEY}`,
    customChains: [
      {
        network: 'seiTestnet',
        chainId: 713715,
        urls: {
          apiURL: 'https://seitrace.com/api',
          browserURL: 'https://seitrace.com/',
        },
      },
      {
        network: 'mode',
        chainId: 34443,
        urls: {
          apiURL: 'https://explorer.mode.network/api',
          browserURL: 'https://explorer.mode.network/',
        },
      },
      {
        network: 'blastTestnet',
        chainId: 168587773,
        urls: {
          apiURL: 'https://api-sepolia.blastscan.io/api',
          browserURL: 'https://sepolia.blastscan.io/',
        },
      },
      {
        network: 'mantle',
        chainId: 5000,
        urls: {
          apiURL: 'https://explorer.mantle.xyz/api',
          browserURL: 'https://explorer.mantle.xyz/',
        },
      },
      {
        network: 'beraTestnet',
        chainId: 80085,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/testnet/evm/80085/etherscan/api/',
          browserURL: 'https://artio.beratrail.io/',
        },
      },
      {
        network: 'baseMainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org/',
        },
      },
      {
        network: 'baseSepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org/',
        },
      },
      {
        network: 'scrollSepolia',
        chainId: 534351,
        urls: {
          apiURL: 'https://api-sepolia.scrollscan.com/api',
          browserURL: 'https://scroll-testnet-public.unifra.io',
        },
      },
      {
        network: 'hekla',
        chainId: 167009,
        urls: {
          apiURL: 'https://api-hekla.taikoscan.io/api',
          browserURL: 'https://hekla.taikoscan.io/',
        },
      },
      {
        network: 'taiko',
        chainId: 167000,
        urls: {
          apiURL: 'https://api.taikoscan.io/api',
          browserURL: 'https://taikoscan.io/',
        },
      },
      {
        network: 'zetachain',
        chainId: 7000,
        urls: {
          apiURL: 'https://zetachain.blockscout.com/api',
          browserURL: 'https://zetachain.blockscout.com',
        },
      }
    ],
  },
};
