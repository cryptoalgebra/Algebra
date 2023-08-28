import { BigNumberish, Signature, Wallet, MaxUint256 } from 'ethers';
import { TestERC20, TestERC20PermitAllowed } from '../../typechain';

export async function getPermitSignature(
  wallet: Wallet,
  token: TestERC20 | TestERC20PermitAllowed,
  spender: string,
  value: BigNumberish = MaxUint256,
  deadline = MaxUint256,
  permitConfig?: { nonce?: BigNumberish; name?: string; chainId?: number; version?: string }
): Promise<Signature> {
  if (!wallet.provider) throw new Error('No provider');
  const [nonce, name, version, chainId] = await Promise.all([
    permitConfig?.nonce ?? token.nonces(wallet.address),
    permitConfig?.name ?? token.name(),
    permitConfig?.version ?? '1',
    permitConfig?.chainId ?? (await wallet.provider.getNetwork()).chainId,
  ]);

  return Signature.from(
    await wallet.signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: await token.getAddress(),
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  );
}
