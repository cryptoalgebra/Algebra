import { utils, Wallet, ContractFactory } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { getDeploymentNonce } from "../../../scripts/getDeploymentNonce";
import { getZKAddress } from "../../../scripts/getZKAddress";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script`);
  // Initialize the wallet.
  const wallet = new Wallet("0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110");
  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);
  const poolDeployerAddress = getZKAddress({
    from: deployer.zkWallet.address, 
    nonce: (await getDeploymentNonce(deployer)).add(1)
  });
  console.log(poolDeployerAddress)

  // Load contract
  const artifact = await deployer.loadArtifact("AlgebraFactory");
  // `greeting` is an argument for contract constructor.
  const factory = await deployer.deploy(artifact, [poolDeployerAddress]);
  await factory.deployed()
  // Show the contract info.
  console.log(`${artifact.contractName} was deployed to ${factory.address}`);

  const vaultAddress = await factory.communityVault();
    // Load contract
  const artifactPD = await deployer.loadArtifact("AlgebraPoolDeployer");
    // `greeting` is an argument for contract constructor.
  const poolDeployer = await deployer.deploy(artifactPD, [factory.address, vaultAddress]);
  await poolDeployer.deployed()

  console.log(`${artifactPD.contractName} was deployed to ${poolDeployer.address}`);
}