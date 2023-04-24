const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
  const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

  const incentiveMaker = '0xDeaD1F5aF792afc125812E875A891b038f888258'

  const AlgebraEternalFarmingFactory = await hre.ethers.getContractFactory('AlgebraEternalFarming')
  const AlgebraEternalFarming = await AlgebraEternalFarmingFactory.deploy(deploysData.poolDeployer, deploysData.nonfungiblePositionManager)

  await AlgebraEternalFarming.deployed()
  console.log('AlgebraEternalFarming deployed to:', AlgebraEternalFarming.address)

  const FarmingCenterFactory = await hre.ethers.getContractFactory('FarmingCenter')
  const FarmingCenter = await FarmingCenterFactory.deploy(AlgebraEternalFarming.address, deploysData.nonfungiblePositionManager)

  await FarmingCenter.deployed()
  console.log('FarmingCenter deployed to:', FarmingCenter.address)

  await AlgebraEternalFarming.setFarmingCenterAddress(FarmingCenter.address)
  console.log('Updated farming center address in eternal(incentive) farming')

  await AlgebraEternalFarming.setIncentiveMaker(incentiveMaker)
  console.log('Updated incentive maker')

  await FarmingCenterVault.setFarmingCenter(FarmingCenter.address)
  console.log('Updated farming center address in farming center vault')

  const factory = await hre.ethers.getContractAt('IAlgebraFactory', deploysData.factory)

  await factory.setFarmingAddress(FarmingCenter.address)
  console.log('Updated farming center address in factory')

  const posManager = await hre.ethers.getContractAt(
    '/contracts/interfaces/INonfungiblePositionManager.sol:INonfungiblePositionManager',
    deploysData.nonfungiblePositionManager
  )
  await posManager.setFarmingCenter(FarmingCenter.address)
  // await hre.run("verify:verify", {
  //   address: AlgebraFarming.address,
  //   constructorArguments: [
  //     deploysData.poolDeployer,
  //     deploysData.nonfungiblePositionManager,
  //     VirtualPoolDeployer.address,
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
