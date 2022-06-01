const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const AlgebraTokenVault = await hre.ethers.getContractFactory("AlgebraVault");
    const AlgebraTokenVaultDeploy = await AlgebraTokenVault.deploy(
        '0x0169ec1f8f639b32eec6d923e24c2a2ff45b9dd6',
        '0xc5aAcB4D1A87a733E24f9a007D5ae1Bb8280C8f8',
        '0x89D6B81A1Ef25894620D05ba843d83B0A296239e'
    );

  await AlgebraTokenVaultDeploy.deployed();

  console.log("AlgebraTokenVault deployed to:", AlgebraTokenVaultDeploy.address);

  await hre.run("verify:verify", {
    address: AlgebraTokenVaultDeploy.address,
    constructorArguments: [
        '0x0169ec1f8f639b32eec6d923e24c2a2ff45b9dd6',
        '0xc5aAcB4D1A87a733E24f9a007D5ae1Bb8280C8f8',
        '0x89D6B81A1Ef25894620D05ba843d83B0A296239e'
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