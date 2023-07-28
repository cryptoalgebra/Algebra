import { utils, Wallet, ContractFactory } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";


import * as path from "path";
import * as fs from "fs";

export default async function (hre: HardhatRuntimeEnvironment) {

    const deployDataPath = path.resolve(__dirname, '../../../deploys.json')
    const deploysData = JSON.parse(fs.readFileSync(deployDataPath, 'utf8'))

    const wallet = new Wallet(hre.network.config.accounts[0]);
    const deployer = new Deployer(hre, wallet);

    const artifact = await deployer.loadArtifact("DataStorageFactory");
    const dsFactory = await deployer.deploy(artifact, [deploysData.factory]);
    await dsFactory.deployed();

    console.log(`${artifact.contractName} was deployed to ${dsFactory.address}`);

    deploysData.dataStorageFactory = dsFactory.address;
    fs.writeFileSync(deployDataPath, JSON.stringify(deploysData), 'utf-8');

}
