const execSync = require('child_process').execSync;

const network = process.argv[2];

execSync(`cd src/core && npm run compile && npx hardhat deploy-zksync --network ${network} --script deploy.ts`, {stdio: 'inherit'});

xecSync(`cd src/plugins && npm run compile && npx hardhat deploy-zksync --network ${network} --script deploy.ts`, {stdio: 'inherit'});

execSync(`cd src/periphery && npm run compile && npx hardhat deploy-zksync --network ${network} --script deploy.ts`, {stdio: 'inherit'});

execSync(`cd src/farming && npx hardhat run --network ${network} scripts/deploy.js`, {stdio: 'inherit'});
