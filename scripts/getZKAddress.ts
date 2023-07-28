import * as ethers from "ethers";

export function getZKAddress(params) {
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