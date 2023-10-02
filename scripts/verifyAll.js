const execSync = require('child_process').execSync;

const network = process.argv[2];

execSync(`cd src/core && npx hardhat run --network ${network} scripts/verify.js`, {stdio: 'inherit'});

execSync(`cd src/plugin && npx hardhat run --network ${network} scripts/verify.js`, {stdio: 'inherit'});

execSync(`cd src/periphery && npx hardhat run --network ${network} scripts/verify.js`, {stdio: 'inherit'});

execSync(`cd src/farming && npx hardhat run --network ${network} scripts/verify.js`, {stdio: 'inherit'});