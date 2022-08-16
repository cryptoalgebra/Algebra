const hre = require('hardhat')
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  // WNativeTokenAddress  
  const WNativeTokenAddress = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
  const signers = await hre.ethers.getSigners()
  const ProxyAdmin = signers[0].address;

  const TickLensFactory = await hre.ethers.getContractFactory('TickLens')
  const TickLens = await TickLensFactory.deploy()

  await TickLens.deployed()


  // arg1 factory address
  // arg2 wnative address
  const QuoterFactory = await hre.ethers.getContractFactory("Quoter");
  const Quoter = await QuoterFactory.deploy(deploysData.factory, WNativeTokenAddress, deploysData.poolDeployer);

  await Quoter.deployed()

  console.log('Quoter deployed to:', Quoter.address)

  // arg1 factory address
  // arg2 wnative address
  const SwapRouterFactory = await hre.ethers.getContractFactory("SwapRouter");
  const SwapRouter = await SwapRouterFactory.deploy(deploysData.factory, WNativeTokenAddress, deploysData.poolDeployer);

  await SwapRouter.deployed();

  console.log('SwapRouter deployed to:', SwapRouter.address)

  const NFTDescriptorFactory = await hre.ethers.getContractFactory('NFTDescriptor')
  const NFTDescriptor = await NFTDescriptorFactory.deploy()

  await NFTDescriptor.deployed()

    // arg1 wnative address
    const NonfungibleTokenPositionDescriptorFactory = await hre.ethers.getContractFactory(
      'NonfungibleTokenPositionDescriptor',
      {
        libraries: {
          NFTDescriptor: NFTDescriptor.address,
        },
      }
    )
    const NonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptorFactory.deploy(WNativeTokenAddress)
  
    await NonfungibleTokenPositionDescriptor.deployed()
  
    console.log('NonfungibleTokenPositionDescriptor deployed to:', NonfungibleTokenPositionDescriptor.address)

  //console.log('NFTDescriptor deployed to:', NFTDescriptor.address)
  const ProxyFactory = await hre.ethers.getContractFactory("TransparentUpgradeableProxy")
  const Proxy = await ProxyFactory.deploy(NonfungibleTokenPositionDescriptor.address, ProxyAdmin, "0x") 

  console.log('Proxy deployed to:', Proxy.address)
  // // arg1 factory address
  // // arg2 wnative address
  // // arg3 tokenDescriptor address
  const NonfungiblePositionManagerFactory = await hre.ethers.getContractFactory("NonfungiblePositionManager");
  const NonfungiblePositionManager = await NonfungiblePositionManagerFactory.deploy(deploysData.factory, WNativeTokenAddress, Proxy.address, deploysData.poolDeployer);

  await NonfungiblePositionManager.deployed()
  deploysData.nonfungiblePositionManager = NonfungiblePositionManager.address;
  console.log('NonfungiblePositionManager deployed to:', NonfungiblePositionManager.address)



  // // arg1 factory address
  // // arg2 wnative address
  // // arg3 nonfungiblePositionManager address
  const V3MigratorFactory = await hre.ethers.getContractFactory("V3Migrator");
  const V3Migrator = await V3MigratorFactory.deploy(deploysData.factory, WNativeTokenAddress, NonfungiblePositionManager.address,deploysData.poolDeployer);
  
  await V3Migrator.deployed();


  const AlgebraInterfaceMulticallFactory = await hre.ethers.getContractFactory('AlgebraInterfaceMulticall')
  const AlgebraInterfaceMulticall = await AlgebraInterfaceMulticallFactory.deploy()

  await AlgebraInterfaceMulticall.deployed()

  console.log('AlgebraInterfaceMulticall deployed to:', AlgebraInterfaceMulticall.address)
  console.log("V3Migrator deployed to:", V3Migrator.address);
  
  fs.writeFileSync(deployDataPath, JSON.stringify(deploysData), 'utf-8');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
