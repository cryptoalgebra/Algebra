const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const AlgebraFactoryComplied = require('@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json');
  let deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));

  // WNativeTokenAddress
  const WNativeTokenAddress = '0x94373a4919b3240d86ea41593d5eba789fef3848';
  const signers = await hre.ethers.getSigners();
  const ProxyAdmin = signers[0].address;

  deploysData.wrapped = WNativeTokenAddress;

  const entryPointFactory = await hre.ethers.getContractFactory('AlgebraCustomPoolEntryPoint')
  const entryPoint = await entryPointFactory.deploy(deploysData.factory)

  await entryPoint.waitForDeployment()

  deploysData.entryPoint = entryPoint.target
  console.log('EntryPoint deployed to:', entryPoint.target)

  const factory = await hre.ethers.getContractAt(AlgebraFactoryComplied.abi, deploysData.factory)
  
  const deployerRole = await factory.grantRole("0xc9cf812513d9983585eb40fcfe6fd49fbb6a45815663ec33b30a6c6c7de3683b", entryPoint.target);
  await deployerRole.wait()
  const administratorRole = await factory.grantRole("0xb73ce166ead2f8e9add217713a7989e4edfba9625f71dfd2516204bb67ad3442", entryPoint.target);
  await administratorRole.wait()

  const TickLensFactory = await hre.ethers.getContractFactory('TickLens');
  const TickLens = await TickLensFactory.deploy();

  await TickLens.waitForDeployment();

  deploysData.tickLens = TickLens.target;
  console.log('TickLens deployed to:', TickLens.target);

  // arg1 factory address
  // arg2 wnative address
  const QuoterFactory = await hre.ethers.getContractFactory('Quoter');
  const Quoter = await QuoterFactory.deploy(deploysData.factory, WNativeTokenAddress, deploysData.poolDeployer);

  await Quoter.waitForDeployment();

  deploysData.quoter = Quoter.target;
  console.log('Quoter deployed to:', Quoter.target);

  // arg1 factory address
  // arg2 wnative address
  const QuoterV2Factory = await hre.ethers.getContractFactory('QuoterV2');
  const QuoterV2 = await QuoterV2Factory.deploy(deploysData.factory, WNativeTokenAddress, deploysData.poolDeployer);

  await QuoterV2.waitForDeployment();

  deploysData.quoterV2 = QuoterV2.target;
  console.log('QuoterV2 deployed to:', QuoterV2.target);

  // arg1 factory address
  // arg2 wnative address
  const SwapRouterFactory = await hre.ethers.getContractFactory('SwapRouter');
  const SwapRouter = await SwapRouterFactory.deploy(deploysData.factory, WNativeTokenAddress, deploysData.poolDeployer);

  await SwapRouter.waitForDeployment();

  deploysData.swapRouter = SwapRouter.target;
  console.log('SwapRouter deployed to:', SwapRouter.target);

  const NFTDescriptorFactory = await hre.ethers.getContractFactory('NFTDescriptor');
  const NFTDescriptor = await NFTDescriptorFactory.deploy();

  await NFTDescriptor.waitForDeployment();
  // arg1 wnative address
  const NonfungibleTokenPositionDescriptorFactory = await hre.ethers.getContractFactory(
    'NonfungibleTokenPositionDescriptor',
    {
      libraries: {
        NFTDescriptor: NFTDescriptor.target,
      },
    }
  );
  const NonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptorFactory.deploy(
    WNativeTokenAddress,
    'WTLS',
    []
  );

  await NonfungibleTokenPositionDescriptor.waitForDeployment();

  console.log('NonfungibleTokenPositionDescriptor deployed to:', NonfungibleTokenPositionDescriptor.target);

  //console.log('NFTDescriptor deployed to:', NFTDescriptor.target)
  const ProxyFactory = await hre.ethers.getContractFactory('TransparentUpgradeableProxy');
  const Proxy = await ProxyFactory.deploy(NonfungibleTokenPositionDescriptor.target, ProxyAdmin, '0x');

  await Proxy.waitForDeployment();

  deploysData.proxy = Proxy.target;

  console.log('Proxy deployed to:', Proxy.target);
  // // arg1 factory address
  // // arg2 wnative address
  // // arg3 tokenDescriptor address
  const NonfungiblePositionManagerFactory = await hre.ethers.getContractFactory('NonfungiblePositionManager');
  const NonfungiblePositionManager = await NonfungiblePositionManagerFactory.deploy(
    deploysData.factory,
    WNativeTokenAddress,
    Proxy.target,
    deploysData.poolDeployer
  );

  await NonfungiblePositionManager.waitForDeployment();

  deploysData.nonfungiblePositionManager = NonfungiblePositionManager.target;
  console.log('NonfungiblePositionManager deployed to:', NonfungiblePositionManager.target);

  // // arg1 factory address
  // // arg2 wnative address
  // // arg3 nonfungiblePositionManager address
  // const V3MigratorFactory = await hre.ethers.getContractFactory('V3Migrator');
  // const V3Migrator = await V3MigratorFactory.deploy(
  //   deploysData.factory,
  //   WNativeTokenAddress,
  //   NonfungiblePositionManager.target,
  //   deploysData.poolDeployer
  // );

  // await V3Migrator.waitForDeployment();

  const AlgebraInterfaceMulticallFactory = await hre.ethers.getContractFactory('AlgebraInterfaceMulticall');
  const AlgebraInterfaceMulticall = await AlgebraInterfaceMulticallFactory.deploy();

  await AlgebraInterfaceMulticall.waitForDeployment();

  console.log('AlgebraInterfaceMulticall deployed to:', AlgebraInterfaceMulticall.target);
  // console.log('V3Migrator deployed to:', V3Migrator.target);

  fs.writeFileSync(deployDataPath, JSON.stringify(deploysData), 'utf-8');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
