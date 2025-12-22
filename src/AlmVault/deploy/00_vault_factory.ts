import { UV3Math, AlgebraVaultFactory, AlgebraVaultDepositGuard } from "../types";
import hre from "hardhat";

async function main() {
    const algebraFactory = "0x9bf6453A15eD1eE6111A4DE8F03F9be34c63FE98";
    const pluginDeployer = "0x0000000000000000000000000000000000000000";
    const nftManager = "0xec7d7054D39416BBD8c4784eaa7790516B401532";
    const eternalFarming = "0x8440352A89534588078D3286D4b4be9e7F50F819";
    const wrapNative = "0x4200000000000000000000000000000000000006";

    const feeRecipient = "0xDeaD1F5aF792afc125812E875A891b038f888258";
    const ammFee = "100000000000000000";
    const baseFee = "100000000000000000";

    const uV3MathFactory = await hre.ethers.getContractFactory("UV3Math");
    const uV3Math = await uV3MathFactory.deploy() as UV3Math;
    await uV3Math.waitForDeployment();

    const algebraVaultDeployer = await hre.ethers.getContractFactory("AlgebraVaultDeployer", {
        libraries: {
            UV3Math: await uV3Math.getAddress(),
        },
    });
    const libAlgebraVaultDeployer = await algebraVaultDeployer.deploy();
    await libAlgebraVaultDeployer.waitForDeployment();

    const farmingRewardsDistributorDeployer = await hre.ethers.getContractFactory("FarmingRewardsDistributorDeployer");
    const libFarmingRewardsDistributorDeployer = await farmingRewardsDistributorDeployer.deploy();
    await libFarmingRewardsDistributorDeployer.waitForDeployment();

    const algebraVaultFactoryFactory = await hre.ethers.getContractFactory("AlgebraVaultFactory", {
        libraries: {
            AlgebraVaultDeployer: await libAlgebraVaultDeployer.getAddress(),
            FarmingRewardsDistributorDeployer: await libFarmingRewardsDistributorDeployer.getAddress(),
        },
    });

    const algebraVaultFactory = await algebraVaultFactoryFactory.deploy(
        algebraFactory,
        pluginDeployer,
        eternalFarming,
        nftManager,
        "ALGEBRA"
    ) as AlgebraVaultFactory;
    await algebraVaultFactory.waitForDeployment();

    const factoryAddress = await algebraVaultFactory.getAddress();
    console.log("AlgebraVaultFactory deployed to:", factoryAddress);

    console.log("Setting fee recipient to:", feeRecipient);
    let tx = await algebraVaultFactory.setFeeRecipient(feeRecipient);
    await tx.wait();

    console.log("Setting AMM fees...");
    tx = await algebraVaultFactory.setAmmFee(ammFee);
    await tx.wait();
    tx = await algebraVaultFactory.setBaseFee(baseFee);
    await tx.wait();

    const algebraVaultDepositGuardFactory = await hre.ethers.getContractFactory("AlgebraVaultDepositGuard");
    const algebraVaultDepositGuard = await algebraVaultDepositGuardFactory.deploy(
        factoryAddress,
        wrapNative
    ) as AlgebraVaultDepositGuard;
    await algebraVaultDepositGuard.waitForDeployment();

    const guardAddress = await algebraVaultDepositGuard.getAddress();
    console.log("AlgebraVaultDepositGuard deployed to:", guardAddress);

    await hre.run("verify:verify", {
        address: guardAddress,
        constructorArguments: [factoryAddress, wrapNative],
    });

    await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [algebraFactory, pluginDeployer, eternalFarming, nftManager, "ALGEBRA"],
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