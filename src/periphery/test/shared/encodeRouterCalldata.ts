
function appendValue(string: bigint, value: bigint, length: bigint) {
    string = (string << length) | value;
    return string;
}

function encodeAmount(amount: bigint): [bigint, bigint] {
    let out;
    let amountLengthData;
    let outLength;
    if (amount % 1000n == 0n) {
        // encode as X * 10**Y
        let multiplier = amount;
        let power = 0;
        while (multiplier % 10n == 0n && power < 16) { // TODO balance powers
            power++;
            multiplier = multiplier / 10n;
        }

        const length = BigInt(multiplier.toString(2).length);
        amountLengthData = BigInt(1);
        amountLengthData = appendValue(amountLengthData, length - 1n, 7n)
        amountLengthData = appendValue(amountLengthData, BigInt(power) - 1n, 4n)
        out = appendValue(amountLengthData, multiplier, length)
        outLength = length + 8n + 4n;
    } else {
        const length = BigInt(amount.toString(2).length)
        amountLengthData = (length - 1n);
        out = appendValue(amountLengthData, amount, length);
        outLength = length + 8n;
    }
    
    return [out, outLength];   
}

export type EncodeRouterCalldataParams = {
    exactIn?: boolean, 
    feeOnTransfer?: boolean,
    hasRecipient?: boolean,
    hasLimitSqrtPrice?: boolean,
    hasDeadline?: boolean,
    tokens: number[],
    amountIn: bigint,
    amountOut: bigint,
    recipient?: string,
    limitSqrtPrice?: bigint,
    deadline?: bigint
    wrappedNative?: boolean
}

export function encodeRouterCalldata(params: EncodeRouterCalldataParams): string {

    let OUT = BigInt(0);
    // encode config
    let config = 1n << 7n;
    if (params.exactIn) config = config | (1n << 6n);
    if (params.feeOnTransfer) config = config | (BigInt(1) << BigInt(5));
    if (params.hasRecipient) config = config | (BigInt(1) << BigInt(4));
    if (params.hasLimitSqrtPrice) config = config | (BigInt(1) << BigInt(3));
    config = config | BigInt(params.tokens.length);
    
    // encode path
    let maxTokenNum = 0;
    for (let token of params.tokens) {
        if (token > maxTokenNum) maxTokenNum = token;
    }
    const maxTokenBitLength = BigInt(maxTokenNum).toString(2).length;

    let tokenEncoding;
    let tokenLength;
    if (maxTokenBitLength <= 2) {
        [tokenEncoding, tokenLength] = [0, 2];
    } else if (maxTokenBitLength <= 4) {
        [tokenEncoding, tokenLength] = [1, 4];
    } else if (maxTokenBitLength <= 8) {
        [tokenEncoding, tokenLength] = [2, 8];
    } else {
        [tokenEncoding, tokenLength] = [3, 16];
    }

    let path = BigInt(0);
    path = BigInt(tokenEncoding) << (BigInt(tokenLength) * BigInt(params.tokens.length));
    for (let i = 0; i < params.tokens.length; i++) {
        path = path | BigInt(params.tokens[i]) << (BigInt(tokenLength) * BigInt(params.tokens.length - i - 1));
    }

    OUT = appendValue(config, path, BigInt(tokenLength) * BigInt(params.tokens.length) + BigInt(2));
    
    if (params.exactIn) {
        // encode amountIn
        if (!(params.tokens[0] == 0 && !params.wrappedNative)) {
            const [amountInEncoded, amountInLength] = encodeAmount(params.amountIn);
            OUT = appendValue(OUT, amountInEncoded, amountInLength);
        }
        
        // encode amountOut
        const [amountOutEncoded, amountOutLength] = encodeAmount(params.amountOut);
        OUT = appendValue(OUT, amountOutEncoded, amountOutLength);
    } else {
        // encode amountIn
        const [amountInEncoded, amountInLength] = encodeAmount(params.amountIn);
        OUT = appendValue(OUT, amountInEncoded, amountInLength);
        
        if  (!(params.tokens[params.tokens.length - 1] == 0 && !params.wrappedNative)) {
            // encode amountOut
            const [amountOutEncoded, amountOutLength] = encodeAmount(params.amountOut);
            OUT = appendValue(OUT, amountOutEncoded, amountOutLength);
        }
    }

    // additional stuff
    if (params.hasRecipient) {
        const recipient = params.recipient ? params.recipient : BigInt(0);
        OUT = appendValue(OUT, BigInt(recipient), 160n);
    }
    if (params.hasLimitSqrtPrice) {
        const limitSqrtPrice = params.limitSqrtPrice ? params.limitSqrtPrice : BigInt(0);
        OUT = appendValue(OUT, limitSqrtPrice, 160n);
    }
    if (params.hasDeadline) {
        const deadline = params.deadline ? params.deadline : BigInt(0);
        OUT = appendValue(OUT, deadline, 32n);
    }

    const binaryLength = OUT.toString(2).length;
    if (binaryLength % 8 != 0) {
        let paddedLength = Math.floor(binaryLength/8)*8;
        OUT = OUT << BigInt(paddedLength - binaryLength);
    }

    return OUT.toString(16);
}



