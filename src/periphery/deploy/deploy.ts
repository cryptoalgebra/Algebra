import { utils, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import * as path from "path";
import * as fs from "fs";

const hrez = require('hardhat')

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script`);

  const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))
  
  const factory = deploysData.factory;
  const poolDeployer = deploysData.poolDeployer;
  const weth = "0x20b28B1e4665FFf290650586ad76E977EAb90c5D"; 

  // Initialize the wallet.
  const wallet = new Wallet(hre.network.config.accounts[0]);

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  const quoterArtifact = await deployer.loadArtifact("Quoter");
  // `greeting` is an argument for contract constructor.
  const quoter = await deployer.deploy(quoterArtifact, [factory, weth, poolDeployer]);
  await quoter.deployed()
  // Show the contract info.
  console.log(`${quoterArtifact.contractName} was deployed to ${quoter.address}`);
  deploysData.quoter = quoter.address;

  const verificationId = await hre.run("verify:verify", {
    address: quoter.address,
    contract: "contracts/lens/Quoter.sol:Quoter",
    constructorArguments: [factory, weth, poolDeployer],
  });
  console.log(verificationId)
  const SwapRouterArtifact = await deployer.loadArtifact("SwapRouter");
  // `greeting` is an argument for contract constructor.
  const router = await deployer.deploy(SwapRouterArtifact, [factory, weth, poolDeployer]);
  await router.deployed()
  // Show the contract info.
  console.log(`${SwapRouterArtifact.contractName} was deployed to ${router.address}`);
  deploysData.router = router.address;

  const verificationId1 = await hre.run("verify:verify", {
    address: router.address,
    contract: "contracts/SwapRouter.sol:SwapRouter",
    constructorArguments: [factory, weth, poolDeployer],
  });

  // const NFTDescriptorArtifact = await deployer.loadArtifact("NFTDescriptor")
  // const NFTDescriptor  = await deployer.deploy(NFTDescriptorArtifact, []);
  // await NFTDescriptor.deployed()
  // // Show the contract info.
  // console.log(`${NFTDescriptorArtifact.contractName} was deployed to ${NFTDescriptor.address}`);
  // deploysData.NFTDescriptor = NFTDescriptor.address;

  // const NonfungibleTokenPositionDescriptorArtifact = await deployer.loadArtifact("NonfungibleTokenPositionDescriptor");

  // const NonfungibleTokenPositionDescriptor = await  deployer.deploy(NonfungibleTokenPositionDescriptorArtifact, [weth, "ETH", []]);
  // await NonfungibleTokenPositionDescriptor.deployed()

  // console.log(`${NonfungibleTokenPositionDescriptorArtifact.contractName} was deployed to ${NonfungibleTokenPositionDescriptor.address}`);
  // deploysData.NonfungibleTokenPositionDescriptor = NonfungibleTokenPositionDescriptor.address;

  const ProxyFactory = await deployer.loadArtifact("TransparentUpgradeableProxy")
  const Proxy = await deployer.deploy(ProxyFactory, ["0x6aFbCDF398328aD3adcf96f6aD6916685EE5D67b",wallet.address , "0x"]) 
  await Proxy.deployed()
  console.log('Proxy deployed to:', Proxy.address)

  const NonfungiblePositionManagerArtifact = await deployer.loadArtifact("NonfungiblePositionManager");
  // `greeting` is an argument for contract constructor.
  const NonfungiblePositionManager = await deployer.deploy(NonfungiblePositionManagerArtifact, [factory, weth, Proxy.address, poolDeployer]);
  await NonfungiblePositionManager.deployed()
  // Show the contract info.
  console.log(`${NonfungiblePositionManagerArtifact.contractName} was deployed to ${NonfungiblePositionManager.address}`);
  deploysData.nonfungiblePositionManager = NonfungiblePositionManager.address;

  const verificationId2 = await hre.run("verify:verify", {
    address: NonfungiblePositionManager.address,
    contract: "contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager",
    constructorArguments: [factory, weth, Proxy.address, poolDeployer],
  });

  const mcallArtifacts = await deployer.loadArtifact("AlgebraInterfaceMulticall");
  // `greeting` is an argument for contract constructor.
  const mcall = await deployer.deploy(mcallArtifacts, []);
  await mcall.deployed()
  // Show the contract info.
  console.log(`${mcallArtifacts.contractName} was deployed to ${mcall.address}`);
  deploysData.mcall = mcall.address;

  fs.writeFileSync(deployDataPath, JSON.stringify(deploysData));
}