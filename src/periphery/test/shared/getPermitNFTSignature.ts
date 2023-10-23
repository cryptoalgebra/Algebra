import { BigNumberish, Signature, Wallet, MaxUint256 } from 'ethers';
import { NonfungiblePositionManager } from '../../typechain';

export default async function getPermitNFTSignature(
  wallet: Wallet,
  positionManager: NonfungiblePositionManager,
  spender: string,
  tokenId: BigNumberish,
  deadline: BigNumberish = MaxUint256,
  permitConfig?: { nonce?: BigNumberish; name?: string; chainId?: number; version?: string }
): Promise<Signature> {
  if (!wallet.provider) throw new Error('No provider');
  const [nonce, name, version, chainId] = await Promise.all([
    permitConfig?.nonce ?? positionManager.positions(tokenId).then((p) => p.nonce),
    permitConfig?.name ?? positionManager.name(),
    permitConfig?.version ?? '2',
    permitConfig?.chainId ?? (await wallet.provider.getNetwork()).chainId,
  ]);

  return Signature.from(
    await wallet.signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: await positionManager.getAddress(),
      },
      {
        Permit: [
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'tokenId',
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
        tokenId,
        nonce,
        deadline,
      }
    )
  );
}
