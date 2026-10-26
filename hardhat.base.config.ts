const path = require('path');
const config = require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });
const { ETHERSCAN_API_KEY, MNEMONIC, INFURA_ID_PROJECT } = config.parsed || {};
const accounts = [`0x${MNEMONIC || '1000000000000000000000000000000000000000000000000000000000000000'}`];

export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      loggingEnabled: false,
      hardfork: 'cancun',
    },
    localHardhat: {
      url: `http://127.0.0.1:8545`,
      accounts: ['0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_ID_PROJECT}`,
      chainId: 1,
      accounts,
    },
    bsc: {
      url: `https://bsc-dataseed.binance.org`,
      chainId: 56,
      accounts,
    },
    avalanche: {
      url: `https://avalanche.drpc.org`,
      chainId: 43114,
      accounts,
    },
    gnosis: {
      url: `https://rpc.gnosischain.com`,
      chainId: 100,
      accounts,
    },
    monad: {
      url: `https://rpc.monad.xyz`,
      chainId: 143,
      accounts,
    },
  },
  // sourcify: {
  //   enabled: true,
  //   apiUrl: 'https://sourcify-api-monad.blockvision.org/',
  //   browserUrl: 'https://monadvision.com/',
  // },
  etherscan: {
    // enabled: false, // for sourcify verification
    // Your API key for Etherscan (v2 API, one for all chains)
    // Obtain one at https://etherscan.io/
    apiKey: `${ETHERSCAN_API_KEY}`, // for etherscan
    // apiKey: { avalanche: 'any', gnosis: 'any' }, // for blockscout and routescan: a key per network, any non-empty string
    customChains: [
      {
        network: 'bsc',
        chainId: 56,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=56',
          browserURL: 'https://bscscan.com/',
        },
      },
      {
        network: 'avalanche',
        chainId: 43114,
        urls: {
          apiURL: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan',
          browserURL: 'https://snowtrace.io/',
        },
      },
      {
        network: 'gnosis',
        chainId: 100,
        urls: {
          apiURL: 'https://gnosisscan.io/api',
          browserURL: 'https://gnosisscan.io',
        },
      },
    ],
  },
};
