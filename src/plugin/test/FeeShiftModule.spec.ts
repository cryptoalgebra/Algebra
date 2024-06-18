import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { ZERO_ADDRESS, mockFactoryFixture } from './shared/fixtures';
import { PLUGIN_FLAGS, encodePriceSqrt } from "./shared/utilities";
import { AlgebraModularHub, FeeShiftModuleFactory, MockPool } from "../typechain";


describe("FeeShiftModule", function () {
    async function deployAlgebraModularHubFixture() {
        const [owner, otherAccount] = await ethers.getSigners();

        const { mockFactory } = await mockFactoryFixture();

        const PoolMock = await ethers.getContractFactory("MockPool");

        const poolMock = await PoolMock.deploy() as any as MockPool;

        const feeShiftModuleFactoryFactory = await ethers.getContractFactory("FeeShiftModuleFactory");
        const feeShiftModuleFactory = await feeShiftModuleFactoryFactory.deploy(mockFactory) as any as FeeShiftModuleFactory;

        const basePluginFactoryFactory = await ethers.getContractFactory("MockTimeDSFactory");
        const basePluginFactory = await basePluginFactoryFactory.deploy(mockFactory, [feeShiftModuleFactory]);

        await mockFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("POOLS_ADMINISTRATOR")), basePluginFactory);
        await mockFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR")), basePluginFactory);

        await poolMock.setPluginFactory(basePluginFactory);

        await basePluginFactory.beforeCreatePoolHook(poolMock, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, '0x');
        const pluginAddress = await basePluginFactory.pluginByPool(poolMock);
        await basePluginFactory.afterCreatePoolHook(pluginAddress, poolMock, ZERO_ADDRESS);

        const algebraModularHubFactory = await ethers.getContractFactory('AlgebraModularHub');
        const algebraModularHub = algebraModularHubFactory.attach(pluginAddress) as any as AlgebraModularHub;

        const feeShiftModuleAddress = await feeShiftModuleFactory.poolToPlugin(poolMock);
        const feeShiftModule_Factory = await ethers.getContractFactory("FeeShiftModule");
        feeShiftModule = await feeShiftModule_Factory.attach(feeShiftModuleAddress);

        return { poolMock, algebraModularHub, owner, otherAccount };
    }

    let poolMock: MockPool;
    let algebraModularHub: any;
    let owner: any;
    let otherAccount: any;
    let feeShiftModule: any;

    beforeEach("Load fixture", async () => {
        ({ poolMock, algebraModularHub, owner, otherAccount } = await loadFixture(
            deployAlgebraModularHubFixture
        ));
    });

    describe("Calculations", function () {
        it("Shifts correct with positive price change", async function () {
            await poolMock.setPrice(2n << 96n);
            await poolMock.pseudoSwap((3n * 1n) << 96n); // last price -> 2
            await network.provider.send("evm_mine")

            // last price    = 2
            // current price = 3
            await poolMock.pseudoSwap((3n * 1n) << 96n);

            expect((await feeShiftModule.s_feeFactors()).oneToZeroFeeFactor).to.be.eq(1n << 63n); // 0.5
            expect((await feeShiftModule.s_feeFactors()).zeroToOneFeeFactor).to.be.eq((3n << 64n) / 2n); // 1.5
        });

        it("Shifts correct with negative price change", async function () {
            await poolMock.setPrice(2n << 96n);

            await poolMock.pseudoSwap((1n * 1n) << 96n); // last price -> 2
            await network.provider.send("evm_mine")

            // last price    = 2
            // current price = 1
            await poolMock.pseudoSwap((3n * 1n) << 96n);

            expect((await feeShiftModule.s_feeFactors()).oneToZeroFeeFactor).to.be.eq((3n << 64n) / 2n); // 1.5
            expect((await feeShiftModule.s_feeFactors()).zeroToOneFeeFactor).to.be.eq(1n << 63n); // 0.5
        });

        it("Factors should be reset", async function () {
            await poolMock.setPrice(4n << 96n);

            await poolMock.pseudoSwap((6n * 1n) << 96n); // last price -> 4
            await network.provider.send("evm_mine")

            // last price    = 4
            // current price = 6
            await poolMock.pseudoSwap((3n * 1n) << 96n); // last price -> 6; oneToZeroFeeFactor -> 1.5

            // last price    = 6
            // current price = 3
            await poolMock.pseudoSwap((3n * 1n) << 96n);

            expect((await feeShiftModule.s_feeFactors()).oneToZeroFeeFactor).to.be.eq(1n << 64n); // 1
            expect((await feeShiftModule.s_feeFactors()).zeroToOneFeeFactor).to.be.eq(1n << 64n); // 1
        });

        it("Shift correct after two oneToZero (positive) movements", async function () {
            await poolMock.setPrice(8n << 96n);

            await poolMock.pseudoSwap((4n * 1n) << 96n); // last price -> 8
            await network.provider.send("evm_mine");

            // last price    = 8
            // current price = 4
            await poolMock.pseudoSwap((3n * 1n) << 96n); // last price -> 4; oneToZeroFeeFactor -> 1.5
            await network.provider.send("evm_mine")

            // last price    = 4
            // current price = 3
            await poolMock.pseudoSwap((5n * 1n) << 96n); // oneToZeroFeeFactor should increase on 0.25

            expect((await feeShiftModule.s_feeFactors()).oneToZeroFeeFactor).to.be.eq((7n << 64n) / 4n); // 1.75
            expect((await feeShiftModule.s_feeFactors()).zeroToOneFeeFactor).to.be.eq((1n << 64n) / 4n); // 0.25
        });

        it("Shift correct after two zeroToOne (positive) movements", async function () {
            await poolMock.setPrice(8n << 96n);

            await poolMock.pseudoSwap((12n * 1n) << 96n); // last price -> 8
            await network.provider.send("evm_mine");

            // last price    = 8
            // current price = 12
            await poolMock.pseudoSwap((15n * 1n) << 96n); // last price -> 12; zeroToOneFeeFactor -> 1.5
            await network.provider.send("evm_mine")

            // last price    = 12
            // current price = 15
            await poolMock.pseudoSwap((16n * 1n) << 96n); // zeroToOneFeeFactor should increase on 0.25

            expect((await feeShiftModule.s_feeFactors()).oneToZeroFeeFactor).to.be.eq((1n << 64n) / 4n); // 0.25
            expect((await feeShiftModule.s_feeFactors()).zeroToOneFeeFactor).to.be.eq((7n << 64n) / 4n); // 1.75
        });
    });
});
