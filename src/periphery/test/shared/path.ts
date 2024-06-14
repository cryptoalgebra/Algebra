import { getAddress } from 'ethers';

const ADDR_SIZE = 20;
const FEE_SIZE = 3;
const OFFSET = ADDR_SIZE;
const DATA_SIZE = OFFSET + ADDR_SIZE;

export function encodePath(path: string[]): string {
  let encoded = '0x';
  for (let i = 0; i < path.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2);
  }

  return encoded.toLowerCase();
}

function decodeOne(tokenFeeToken: Buffer): [[string, string, string]] {
  // reads the first 20 bytes for the token address
  const tokenABuf = tokenFeeToken.slice(0, ADDR_SIZE);
  const tokenA = getAddress('0x' + tokenABuf.toString('hex'));

  // reads the first 20 bytes for the deployer address
  const deployerBuf = tokenFeeToken.slice(OFFSET, DATA_SIZE);
  const deployer = getAddress('0x' + deployerBuf.toString('hex'));
  
  // reads the next 20 bytes for the token address
  const tokenBBuf = tokenFeeToken.slice(DATA_SIZE, DATA_SIZE + ADDR_SIZE);
  const tokenB = getAddress('0x' + tokenBBuf.toString('hex'));

  return [[tokenA, deployer, tokenB]];
}

export function decodePath(path: string): [string[]] {
  let data = Buffer.from(path.slice(2), 'hex');

  let tokens: string[] = [];
  let i = 0;
  let finalToken: string = '';
  while (data.length >= DATA_SIZE) {
    const [[tokenA, deployer, tokenB]] = decodeOne(data);
    finalToken = tokenB;
    tokens = [...tokens, tokenA, deployer];
    data = data.slice((i + 1) * DATA_SIZE);
    i += 1;
  }
  tokens = [...tokens, finalToken];

  return [tokens];
}
