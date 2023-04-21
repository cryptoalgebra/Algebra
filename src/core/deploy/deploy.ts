import { utils, Wallet, ContractFactory } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { getDeploymentNonce } from "../../../scripts/getDeploymentNonce";
import { getZKAddress } from "../../../scripts/getZKAddress";

import * as path from "path";
import * as fs from "fs";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

  console.log(`Running deploy script`);
  // Initialize the wallet.
  const wallet = new Wallet(hre.network.config.accounts[0]);
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

  deploysData.poolDeployer = poolDeployer.address;
  deploysData.factory = factory.address;
  deploysData.communityVault = vaultAddress;
  fs.writeFileSync(deployDataPath, JSON.stringify(deploysData));
}