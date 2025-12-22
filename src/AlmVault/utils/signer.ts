import { ethers } from "hardhat";

export async function getSignersWithAddresses() {
  const signers = await ethers.getSigners();
  return signers.map((signer) => [signer, signer.address] as const);
}
