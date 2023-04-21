import { ContractFactory } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

export async function getDeploymentNonce(deployer: Deployer) {
    const nonceHolder = '0x0000000000000000000000000000000000008003';
    const nonceHolderContract = ContractFactory.getContract(nonceHolder, INonceHolderAbi, deployer.zkWallet);
    return await nonceHolderContract.getDeploymentNonce(deployer.zkWallet.address);
}
  
  
const INonceHolderAbi = `[
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_address",
          "type": "address"
        }
      ],
      "name": "getDeploymentNonce",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }]`;