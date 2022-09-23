const execSync = require('child_process').execSync;

const network = process.argv[2];

execSync(`cd src/core && npx hardhat run --network ${network} scripts/deploy.js`, {stdio: 'inherit'});