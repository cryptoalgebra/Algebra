const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

  const AlgebraEternalFarmingFactory = await hre.ethers.getContractFactory('AlgebraEternalFarming')
  const AlgebraEternalFarming = await AlgebraEternalFarmingFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager, { gasLimit: "0x1000000" })

  console.log('AlgebraEternalFarming deployed to:', AlgebraEternalFarming.target)

  const FarmingCenterFactory = await hre.ethers.getContractFactory('FarmingCenter')
  const FarmingCenter = await FarmingCenterFactory.deploy(AlgebraEternalFarming.target, deploysData.nonfungiblePositionManager,{ gasLimit: "0x1000000" })

  console.log('FarmingCenter deployed to:', FarmingCenter.target)

  await AlgebraEternalFarming.setFarmingCenterAddress(FarmingCenter.target, { gasLimit: "0x1000000" })
  console.log('Updated farming center address in eternal(incentive) farming')

  const pluginFactory = await hre.ethers.getContractAt('BasePluginV1Factory', deploysData.BasePluginV1Factory)

  await pluginFactory.setFarmingAddress(FarmingCenter.target, { gasLimit: "0x1000000" })
  console.log('Updated farming center address in plugin factory')

  const posManager = await hre.ethers.getContractAt(
    'INonfungiblePositionManager',
    deploysData.nonfungiblePositionManager
  )
  await posManager.setFarmingCenter(FarmingCenter.target, { gasLimit: "0x1000000" })
  // await hre.run("verify:verify", {
  //   address: AlgebraFarming.target,
  //   constructorArguments: [
  //     deploysData.poolDeployer,
  //     deploysData.nonfungiblePositionManager,
  //     VirtualPoolDeployer.target,
  //     maxIncentiveStartLeadTime,
  //     maxIncentiveDuration,
  //   ],
  // });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
