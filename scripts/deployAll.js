const execSync = require('child_process').execSync;

const network = process.argv[2];

execSync(`cd src/core && npx hardhat run --network ${network} scripts/deploy.js`, {stdio: 'inherit'});

execSync(`cd src/periphery && npx hardhat run --network ${network} scripts/deploy.js`, {stdio: 'inherit'});

execSync(`cd src/tokenomics && npx hardhat run --network ${network} scripts/deploy.js`, {stdio: 'inherit'});