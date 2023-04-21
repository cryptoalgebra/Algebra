const fs = require('fs');
const path = require('path');
const {keccak256} = require('@ethersproject/solidity');
const execSync = require('child_process').execSync;
const ethers = require('ethers');

function updateHash(pathToPool, files) {
    const contract = JSON.parse(fs.readFileSync(path.resolve(__dirname, pathToPool), 'utf8'));

    const COMPUTED_INIT_CODE_HASH = hashBytecode(contract["bytecode"]).toString()

    for (let file of files) {
        let getAddress = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
        getAddress = getAddress.replace(/POOL_INIT_CODE_HASH = [^;]+;/, `POOL_INIT_CODE_HASH = ${COMPUTED_INIT_CODE_HASH};`)
        fs.writeFileSync(path.resolve(__dirname, file), getAddress, 'utf-8');

        execSync('git add "' + path.resolve(__dirname, file) + '"');
    }
}

const MAX_BYTECODE_LEN_BYTES = ((1 << 16) - 1) * 32;
function hashBytecode(bytecode) {
    // For getting the consistent length we first convert the bytecode to UInt8Array
    const bytecodeAsArray = ethers.utils.arrayify(bytecode);

    if (bytecodeAsArray.length % 32 != 0) {
        throw new Error('The bytecode length in bytes must be divisible by 32');
    }

    if (bytecodeAsArray.length > MAX_BYTECODE_LEN_BYTES) {
        throw new Error(`Bytecode can not be longer than ${MAX_BYTECODE_LEN_BYTES} bytes`);
    }

    const hashStr = ethers.utils.sha256(bytecodeAsArray);
    const hash = ethers.utils.arrayify(hashStr);

    // Note that the length of the bytecode
    // should be provided in 32-byte words.
    const bytecodeLengthInWords = bytecodeAsArray.length / 32;
    if (bytecodeLengthInWords % 2 == 0) {
        throw new Error('Bytecode length in 32-byte words must be odd');
    }

    const bytecodeLength = ethers.utils.arrayify(bytecodeLengthInWords);

    // The bytecode should always take the first 2 bytes of the bytecode hash,
    // so we pad it from the left in case the length is smaller than 2 bytes.
    const bytecodeLengthPadded = ethers.utils.zeroPad(bytecodeLength, 2);

    const codeHashVersion = new Uint8Array([1, 0]);
    hash.set(codeHashVersion, 0);
    hash.set(bytecodeLengthPadded, 2);

    return ethers.utils.hexlify(hash);
}

updateHash(
    '../src/core/artifacts-zk/contracts/AlgebraPool.sol/AlgebraPool.json', 
    [
        '../src/periphery/contracts/libraries/PoolAddress.sol',
        '../src/core/contracts/AlgebraFactory.sol',
    ]
);