type ContractWithAddress = {
  address: string;
};

export function compareToken(a: ContractWithAddress, b: ContractWithAddress): -1 | 1 {
  return a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1;
}

export async function sortedTokens(
  a: { getAddress: () => Promise<string> },
  b: { getAddress: () => Promise<string> }
): Promise<[typeof a, typeof b] | [typeof b, typeof a]> {
  const a_: ContractWithAddress = a as any as ContractWithAddress;
  const b_: ContractWithAddress = b as any as ContractWithAddress;
  a_.address = await a.getAddress();
  b_.address = await b.getAddress();
  return compareToken(a_, b_) < 0 ? [a, b] : [b, a];
}
