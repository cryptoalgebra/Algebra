const ethers = require("ethers");

function getZKAddress(params) {
    const prefix = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('zksyncCreate'));
    const addressBytes = ethers.utils
        .keccak256(
            ethers.utils.concat([
                prefix,
                ethers.utils.zeroPad(params.from, 32),
                ethers.utils.zeroPad(ethers.utils.hexlify(params.nonce), 32)
            ])
        )
        .slice(26);

    return ethers.utils.getAddress(addressBytes);
}

module.exports = getZKAddress;

for (let i = 0; i < 100; i++) {
    console.log(i, getZKAddress({
        from: "0xDeaD1F5aF792afc125812E875A891b038f888258",
        nonce: i
    }))
}