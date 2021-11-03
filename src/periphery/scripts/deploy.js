const hre = require('hardhat')
const fs = require('fs');
const path = require('path');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  // WNativeTokenAddress  
  const WNativeTokenAddress = "0xd0a1e359811322d97991e03f863a0c30c2cf029c";

  const TickLensFactory = await hre.ethers.getContractFactory('TickLens')
  const TickLens = await TickLensFactory.deploy()

  await TickLens.deployed()

  console.log('TickLens deployed to:', TickLens.address)

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

  console.log('NFTDescriptor deployed to:', NFTDescriptor.address)

  // arg1 factory address
  // arg2 wnative address
  // arg3 tokenDescriptor address
  const NonfungiblePositionManagerFactory = await hre.ethers.getContractFactory("NonfungiblePositionManager");
  const NonfungiblePositionManager = await NonfungiblePositionManagerFactory.deploy(deploysData.factory, WNativeTokenAddress, NFTDescriptor.address, deploysData.poolDeployer);

  await NonfungiblePositionManager.deployed()
  deploysData.nonfungiblePositionManager = NonfungiblePositionManager.address;
  console.log('NonfungiblePositionManager deployed to:', NonfungiblePositionManager.address)

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

  // arg1 factory address
  // arg2 wnative address
  // arg3 nonfungiblePositionManager address
  // const V3MigratorFactory = await hre.ethers.getContractFactory("V3Migrator");
  // const V3Migrator = await V3MigratorFactory.deploy(factoryAddress, WNativeTokenAddress, NonfungibleTokenPositionDescriptor.address);
  //
  // await V3Migrator.deployed();
  //
  // console.log("V3Migrator deployed to:", V3Migrator.address);


  const AlgebraInterfaceMulticallFactory = await hre.ethers.getContractFactory('AlgebraInterfaceMulticall')
  const AlgebraInterfaceMulticall = await AlgebraInterfaceMulticallFactory.deploy()

  await AlgebraInterfaceMulticall.deployed()

  console.log('AlgebraInterfaceMulticall deployed to:', AlgebraInterfaceMulticall.address)
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
