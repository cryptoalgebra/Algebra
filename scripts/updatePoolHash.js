const fs = require('fs');
const path = require('path');
const {keccak256} = require('@ethersproject/solidity');
const execSync = require('child_process').execSync;

function updateHash(pathToPool, files) {
    const contract = JSON.parse(fs.readFileSync(path.resolve(__dirname, pathToPool), 'utf8'));

    const COMPUTED_INIT_CODE_HASH = keccak256(['bytes'], [`${contract["bytecode"]}`])

    for (let file of files) {
        let getAddress = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
        getAddress = getAddress.replace(/POOL_INIT_CODE_HASH = [^;]+;/, `POOL_INIT_CODE_HASH = ${COMPUTED_INIT_CODE_HASH};`)
        fs.writeFileSync(path.resolve(__dirname, file), getAddress, 'utf-8');

        execSync('git add "' + path.resolve(__dirname, file) + '"');
    }
}

updateHash(
    '../src/core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json', 
    [
        '../src/periphery/contracts/libraries/PoolAddress.sol',
        '../src/core/contracts/AlgebraFactory.sol',
    ]
);