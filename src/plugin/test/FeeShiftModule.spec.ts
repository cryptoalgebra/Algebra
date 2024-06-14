import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { mockFactoryFixture } from './shared/fixtures';
import { PLUGIN_FLAGS, encodePriceSqrt } from "./shared/utilities";
import { AlgebraModularHub, MockPool } from "../typechain";


describe("FeeShiftModule", function () {
    async function deployAlgebraModularHubFixture() {
        const [owner, otherAccount] = await ethers.getSigners();

        const { mockFactory } = await mockFactoryFixture();

        const PoolMock = await ethers.getContractFactory("MockPool");

        const poolMock = await PoolMock.deploy() as any as MockPool;

        const AlgebraModularHub = await ethers.getContractFactory(
            "AlgebraModularHub"
        );
        const algebraModularHub = await AlgebraModularHub.deploy(poolMock, mockFactory) as any as AlgebraModularHub;

        await poolMock.setPlugin(algebraModularHub);

        const feeShiftModuleFactory = await ethers.getContractFactory("FeeShiftModule");
        feeShiftModule = await feeShiftModuleFactory.deploy(algebraModularHub);

        const moduleGlobalIndex = await algebraModularHub.registerModule.staticCall(feeShiftModule);
        await algebraModularHub.registerModule(feeShiftModule);


        const selector =
            algebraModularHub.interface.getFunction("beforeSwap").selector;

        await algebraModularHub.insertModulesToHookLists([{
            selector: selector,
            indexInHookList: 0,
            moduleGlobalIndex: moduleGlobalIndex,
            useDelegate: false,
            useDynamicFee: true
        }]);


        const currentPluginConfig = (await poolMock.globalState()).pluginConfig; 
        await poolMock.setPluginConfig(currentPluginConfig | BigInt(PLUGIN_FLAGS.DYNAMIC_FEE));

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
