const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using node you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
    const POOL = "0xf6d8a1a60df52627f578788a486102992384ff17";

  // We get the contract to deploy
    const AlgebraPool = await hre.ethers.getContractFactory("AlgebraPool");
    const Oracle = await hre.ethers.getContractFactory("DataStorageOperator");

    const algeraPool  = await AlgebraPool.attach(POOL);

    console.log((await algeraPool.globalState()).timepointIndex)
    for (let i = 0; i < 4; i++) {
      let tp = await algeraPool.timepoints(i);
      console.log(tp.toString());
    }
    /*let algbVols = [];
    let times = [];
    for (let i = 100; i < 166; i++) {
      let vol = await getVolatility(algeraPool, i);
      algbVols.push(vol)
      times.push(Math.floor(Date.now()/1000) - i*60);
      console.log(`ALGB/USDC ${i}h`, vol.toString(), Math.floor(Date.now()/1000) - i*60);
      await sleep(100);
    }*/

    //fs.writeFileSync('stats_algb_matic.json', JSON.stringify({vols: algbVols, times: times}));*/
}

async function getVolatility(pool, time) {
  time = time*60;
  let res = await pool.getTimepoints([time]);
  return res.volatilityCumulatives[0] / (24*60*60);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });