import { utils, Wallet } from "zksync-web3";
import hre from "hardhat";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script`);

  // Initialize the wallet.
  const wallet = new Wallet("");

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  const poolDeployerAddress = getZKAddress({
    from: deployer.zkWallet.address, 
    nonce: 52
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

function getZKAddress(params) {
  const prefix = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('zksyncCreate'));
  const addressBytes = ethers.utils
      .keccak256(
          ethers.utils.concat([
              prefix,
              ethers.utils.zeroPad(params.from, 32),
              ethers.utils.zeroPad(ethers.utils.hexlify(params.nonce), 32)
          ])
      )
      .slice(26);

  return ethers.utils.getAddress(addressBytes);
}