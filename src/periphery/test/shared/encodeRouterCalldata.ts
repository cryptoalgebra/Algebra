// append data to string
function appendValue(string: bigint, value: bigint, length: bigint) {
  string = (string << length) | value;
  return string;
}

// tightly encode token amount data
function encodeAmount(amount: bigint): { encodedData: bigint; encodedDataLength: bigint } {
  let out;
  let outLength;

  // often amount looks like X * 10**18 or something
  if (amount % 1000n == 0n) {
    // encode as X * 10**Y
    let multiplier = amount;
    let power = 0;
    while (multiplier % 10n == 0n && power < 16) {
      // TODO balance powers
      power++;
      multiplier = multiplier / 10n;
    }

    // calculate length of encoded data in bits
    const multiplierLength = BigInt(multiplier.toString(2).length);
    out = 1n; // flag that we use X * 10 ** Y encoding
    out = appendValue(out, multiplierLength - 1n, 7n); // 7 bits for multiplier length
    out = appendValue(out, BigInt(power) - 1n, 4n); // 4 bits for power
    out = appendValue(out, multiplier, multiplierLength); // rest for multiplier itself
    outLength = multiplierLength + 12n;
  } else {
    const length = BigInt(amount.toString(2).length);
    out = 0n; // flag that we do not use X * 10 ** Y encoding
    out = appendValue(out, length - 1n, 7n); // 7 bits for length
    out = appendValue(out, amount, length); // rest for amount itself
    outLength = length + 8n;
  }

  return { encodedData: out, encodedDataLength: outLength };
}

function encodeConfig(params: EncodeRouterCalldataParams) {
  let config = 0n;
  // 4 bits for flags
  if (params.exactIn) config |= 1n << 6n;
  if (params.feeOnTransfer) config |= 1n << 5n;
  if (params.unwrapResultWNative) config |= 1n << 4n;
  if (params.hasLimitSqrtPrice) config |= 1n << 3n;

  // 3 bits for path length
  if (params.tokens.length > 7) throw new Error('Too many tokens in path');
  config = config | BigInt(params.tokens.length);
  return config;
}

const TOKEN_ENCODINGS: Record<string, { mode: number; tokenLength: number }> = {
  LOW: { mode: 0, tokenLength: 2 },
  MEDIUM: { mode: 1, tokenLength: 4 },
  HIGH: { mode: 2, tokenLength: 8 },
  HIGHEST: { mode: 3, tokenLength: 16 },
};

function encodePath(tokens: number[]): { path: bigint; tokenLength: number } {
  // get number of bits required to write largest token number in list
  let maxTokenNum = 0;
  for (let token of tokens) {
    if (token > maxTokenNum) maxTokenNum = token;
  }
  const maxTokenBitLength = BigInt(maxTokenNum).toString(2).length;

  // get encoding mode based on number of bits required to write largest token number in list
  let encodingData;
  for (const encoding of ['LOW', 'MEDIUM', 'HIGH', 'HIGHEST']) {
    if (maxTokenBitLength <= TOKEN_ENCODINGS[encoding].tokenLength) {
      encodingData = TOKEN_ENCODINGS[encoding];
      break;
    }
  }
  if (encodingData === undefined) throw new Error('Invalid token number');

  // 2 bits for mode, rest for tokens
  let path = BigInt(encodingData.mode) << (BigInt(encodingData.tokenLength) * BigInt(tokens.length));
  for (let i = 0; i < tokens.length; i++) {
    path |= BigInt(tokens[i]) << (BigInt(encodingData.tokenLength) * BigInt(tokens.length - i - 1));
  }
  return { path, tokenLength: encodingData.tokenLength };
}

function encodeTokensAmount(params: EncodeRouterCalldataParams): { encodedData: bigint; encodedDataLength: bigint } {
  let data = 0n;
  let dataLength = 0n;
  if (params.exactIn) {
    // encode amountIn
    if (!(params.tokens[0] == 0 && !params.wrappedNative)) {
      const { encodedData: amountInEncoded, encodedDataLength: amountInLength } = encodeAmount(params.amountIn);
      data = appendValue(data, amountInEncoded, amountInLength);
      dataLength += amountInLength;
    }

    // encode amountOut
    const { encodedData: amountOutEncoded, encodedDataLength: amountOutLength } = encodeAmount(params.amountOut);
    data = appendValue(data, amountOutEncoded, amountOutLength);
    dataLength += amountOutLength;
  } else {
    // encode amountIn
    const { encodedData: amountInEncoded, encodedDataLength: amountInLength } = encodeAmount(params.amountIn);
    data = appendValue(data, amountInEncoded, amountInLength);
    dataLength += amountInLength;

    if (!(params.tokens[params.tokens.length - 1] == 0 && !params.wrappedNative)) {
      // encode amountOut
      const { encodedData: amountOutEncoded, encodedDataLength: amountOutLength } = encodeAmount(params.amountOut);
      data = appendValue(data, amountOutEncoded, amountOutLength);
      dataLength += amountOutLength;
    }
  }
  return { encodedData: data, encodedDataLength: dataLength };
}

export type EncodeRouterCalldataParams = {
  exactIn?: boolean;
  feeOnTransfer?: boolean;
  unwrapResultWNative?: boolean;
  hasRecipient?: boolean;
  hasLimitSqrtPrice?: boolean;
  hasDeadline?: boolean;
  tokens: number[];
  amountIn: bigint;
  amountOut: bigint;
  recipient?: string;
  limitSqrtPrice?: bigint;
  deadline?: bigint;
  wrappedNative?: boolean;
};

export function encodeRouterCalldata(params: EncodeRouterCalldataParams): string {
  let data = 1n; // first bit always is 1 to prevent signature collisions
  data = appendValue(data, encodeConfig(params), 7n); // 7 bits for config
  // so currently data is 8 bits long

  const { path, tokenLength } = encodePath(params.tokens);
  data = appendValue(data, path, BigInt(tokenLength) * BigInt(params.tokens.length) + BigInt(2));

  const { encodedData: amountsData, encodedDataLength: amountsDataLength } = encodeTokensAmount(params);
  data = appendValue(data, amountsData, amountsDataLength);

  // additional stuff
  if (params.hasLimitSqrtPrice) {
    const limitSqrtPrice = params.limitSqrtPrice ? params.limitSqrtPrice : BigInt(0);
    data = appendValue(data, limitSqrtPrice, 160n);
  }

  if (params.hasRecipient) {
    const recipient = params.recipient ? params.recipient : BigInt(0);
    data = appendValue(data, BigInt(recipient), 160n);
  }

  if (params.hasDeadline) {
    if (params.deadline) {
      data = appendValue(data, params.deadline, 32n);
    }
  }

  // pad data if needed
  const binaryLength = data.toString(2).length;
  const BYTE_SIZE = 8;
  if (binaryLength % BYTE_SIZE != 0) {
    let paddedLength = Math.ceil(binaryLength / BYTE_SIZE) * BYTE_SIZE;
    data = data << BigInt(paddedLength - binaryLength);
  }

  return data.toString(16);
}
