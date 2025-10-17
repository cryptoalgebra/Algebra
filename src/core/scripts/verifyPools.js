const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const deployDataPath = path.resolve(__dirname, './pools.json');
  let poolsData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'));
  let pools = poolsData["data"]["pools"]

  for (let i = 0; i < pools.length; i++){
    try{
        await hre.run('verify:verify', {
            address: pools[i]["id"],
        });
    } catch (error) {
        console.log(pools[i]["id"], "not verified")
    }
  } 

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
