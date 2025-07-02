const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {

    const plugin = "0x4d57eC613d3Bc7BaC34F59177BDe63C1bAb36454";
    const pluginFactory = "0x84aF948871318c58257921d687C7f187Ffa2964e";
    const factory = "0xEdbBc263C74865e67C6b16F47740Fa3901b95Ae1";
    const pool = "0x393E45Cd7AA4FaAFb71F75b2e842a69ce0fb0273";
    const feeConfig = {
            alpha1: 2900,
            alpha2: 12000,
            beta1: 360,
            beta2: 60000,
            gamma1: 59,
            gamma2: 8500,
            baseFee: 100
    };

    await hre.run("verify:verify", {
        address: plugin,
        constructorArguments: [
            pool,
            factory,
            pluginFactory,
            feeConfig
        ],
        });
    
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });