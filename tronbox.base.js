const TronWeb = require("tronweb");

const path = require('path');
const config = require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { TRON_PRIVATE_KEY } =
  config.parsed || {};

const port = 9090

module.exports = {
  tronWeb: {
    nile: new TronWeb({
      fullHost: "https://nile.trongrid.io",
      privateKey: TRON_PRIVATE_KEY,
    })
  },
  networks: {
    mainnet: {
      // Don't put your private key here:
      privateKey: TRON_PRIVATE_KEY,
      /*
Create a .env file (it must be gitignored) containing something like

  export PRIVATE_KEY_MAINNET=4E7FEC...656243

Then, run the migration with:

  source .env && tronbox migrate --network mainnet

      */
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6,
      fullHost: 'https://api.trongrid.io',
      network_id: '1'
    },
    shasta: {
      privateKey: TRON_PRIVATE_KEY,
      userFeePercentage: 50,
      feeLimit: 1000 * 1e6,
      fullHost: 'https://api.shasta.trongrid.io',
      network_id: '2'
    },
    nile: {
      privateKey: TRON_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 2000 * 1e6,
      fullHost: 'https://nile.trongrid.io',
      network_id: '3'
    },
    development: {
      // For tronbox/tre docker image
      privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
      userFeePercentage: 0,
      feeLimit: 1000 * 1e6,
      fullHost: 'http://127.0.0.1:' + port,
      network_id: '9'
    },
    compilers: {
      solc: {
        version: '0.8.20'
      }
    }
  },
  // solc compiler optimize
  solc: {
    optimizer: {
      enabled: true,
      runs: 0
    },
    evmVersion: 'paris'
  }
}
