import { utils, Wallet } from "zksync-web3";
import hre from "hardhat";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script`);
  
  const factory = "0x94aBe74F5c5EB2Fd8758d3B8135682478bF360E7";
  const poolDeployer = "0xb954D708fa98490a5357aB8AB0BA05B9D8E8a377";
  const weth = "0xaAf221d04F50E2AC32B2B21F679997c2d7A835e4"; 

  // Initialize the wallet.
  const wallet = new Wallet("");

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);


  // Load contract
  const quoterArtifact = await deployer.loadArtifact("Quoter");
  // `greeting` is an argument for contract constructor.
  const quoter = await deployer.deploy(quoterArtifact, [factory, weth, poolDeployer]);
  await quoter.deployed()
  // Show the contract info.
  console.log(`${quoterArtifact.contractName} was deployed to ${quoter.address}`);

  const SwapRouterArtifact = await deployer.loadArtifact("SwapRouter");
  // `greeting` is an argument for contract constructor.
  const router = await deployer.deploy(SwapRouterArtifact, [factory, weth, poolDeployer]);
  await router.deployed()
  // Show the contract info.
  console.log(`${SwapRouterArtifact.contractName} was deployed to ${router.address}`);

  const NonfungiblePositionManagerArtifact = await deployer.loadArtifact("NonfungiblePositionManager");
  // `greeting` is an argument for contract constructor.
  const NonfungiblePositionManager = await deployer.deploy(NonfungiblePositionManagerArtifact, [factory, weth, poolDeployer, poolDeployer]);
  await NonfungiblePositionManager.deployed()
  // Show the contract info.
  console.log(`${NonfungiblePositionManagerArtifact.contractName} was deployed to ${NonfungiblePositionManager.address}`);

  const LimitOrderManagerArtifacts = await deployer.loadArtifact("LimitOrderManager");
  // `greeting` is an argument for contract constructor.
  const LimitOrderManager = await deployer.deploy(LimitOrderManagerArtifacts, [factory, weth, poolDeployer]);
  await LimitOrderManager.deployed()
  // Show the contract info.
  console.log(`${LimitOrderManagerArtifacts.contractName} was deployed to ${LimitOrderManager.address}`);

  const mcallArtifacts = await deployer.loadArtifact("AlgebraInterfaceMulticall");
  // `greeting` is an argument for contract constructor.
  const mcall = await deployer.deploy(mcallArtifacts, []);
  await mcall.deployed()
  // Show the contract info.
  console.log(`${mcallArtifacts.contractName} was deployed to ${mcall.address}`);

  const V3MigratorArtifacts = await deployer.loadArtifact("V3Migrator");
  // `greeting` is an argument for contract constructor.
  const migrator = await deployer.deploy(V3MigratorArtifacts, [factory, weth, NonfungiblePositionManager.address, poolDeployer]);
  await migrator.deployed()
  // Show the contract info.
  console.log(`${V3MigratorArtifacts.contractName} was deployed to ${migrator.address}`);
}
