const hre = require('hardhat')
const fs = require('fs')
const path = require('path')
const BasePluginV2FactoryComplied = require('@cryptoalgebra/integral-base-plugin/artifacts/contracts/BasePluginV2Factory.sol/BasePluginV2Factory.json');

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

  const AlgebraEternalFarmingFactory = await hre.ethers.getContractFactory('AlgebraEternalFarming')
  const AlgebraEternalFarming = await AlgebraEternalFarmingFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager)

  deploysData.eternal = AlgebraEternalFarming.target;

  await AlgebraEternalFarming.waitForDeployment()
  console.log('AlgebraEternalFarming deployed to:', AlgebraEternalFarming.target)

  const FarmingCenterFactory = await hre.ethers.getContractFactory('FarmingCenter')
  const FarmingCenter = await FarmingCenterFactory.deploy(AlgebraEternalFarming.target, deploysData.nonfungiblePositionManager)

  deploysData.fc = FarmingCenter.target;

  await FarmingCenter.waitForDeployment()
  console.log('FarmingCenter deployed to:', FarmingCenter.target)

  await (await AlgebraEternalFarming.setFarmingCenterAddress(FarmingCenter.target)).wait()
  console.log('Updated farming center address in eternal(incentive) farming')

  const pluginFactory = await hre.ethers.getContractAt(BasePluginV2FactoryComplied.abi, deploysData.BasePluginV2Factory)

  await (await pluginFactory.setFarmingAddress(FarmingCenter.target)).wait()
  console.log('Updated farming center address in plugin factory')

  const posManager = await hre.ethers.getContractAt(
    'INonfungiblePositionManager',
    deploysData.nonfungiblePositionManager
  )
  await (await posManager.setFarmingCenter(FarmingCenter.target)).wait()

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
