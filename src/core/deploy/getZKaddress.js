const ethers = require("ethers");

function getZKAddress() {
    const prefix = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('zksyncCreate'));
    const addressBytes = ethers.utils
        .keccak256(
            ethers.utils.concat([
                prefix,
                ethers.utils.zeroPad("", 32),
                ethers.utils.zeroPad(ethers.utils.hexlify(), 32)
            ])
        )
        .slice(26);

    return ethers.utils.getAddress(addressBytes);
}

module.exports = getZKAddress;

getZKAddress()