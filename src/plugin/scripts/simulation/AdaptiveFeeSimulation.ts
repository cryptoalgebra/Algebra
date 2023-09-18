import fs from 'fs';
import path from 'path';
import { ethers } from 'hardhat';
import { SimulationAdaptiveFee } from '../../typechain';
import { Wallet } from 'ethers';

const deployContract = async (initTick: string, initTime: string) => {
  const volatilityOracleTestFactory = await ethers.getContractFactory('SimulationAdaptiveFee');
  const contract = (await volatilityOracleTestFactory.deploy()) as any as SimulationAdaptiveFee;
  await contract.init(initTick, initTime);
  return contract;
};

type SimulationRecord = {
  timestamp: number;
  tick: number;
  fee: number;
  volatilityAverage: string;
  tickAverage: number;
  gasUsed: string;
};

async function doSimulation(timeout: number) {
  const [wallet] = (await ethers.getSigners()) as [any] as [Wallet];
  //await ethers.provider.send('hardhat_setBalance', [wallet.address, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000']);
  const events = JSON.parse(fs.readFileSync(path.resolve(__dirname, './external-data/swaps.json')).toString());

  let lastTimestamp = events[0].timestamp;
  let lastTick = events[0].tick;

  const contract = await deployContract(lastTick, lastTimestamp);
  await contract.waitForDeployment();
  console.log('Deployed');

  let i = 0;
  let packNum = 0;
  const records: SimulationRecord[] = [];
  const startTime = Math.floor(Date.now() / 1000);

  let gasCumulative = 0n;

  console.log(`Starting simulation. Amount of swaps: ${events.length}`);

  for (const swap of events) {
    try {
      if (lastTimestamp != Number(swap.timestamp)) {
        //await ethers.provider.send('evm_mine');
        const tx = await contract.update({
          advanceTimeBy: Number(swap.timestamp) - lastTimestamp,
          tick: lastTick,
        });

        lastTimestamp = Number(swap.timestamp);

        let gasUsed = Number((await tx.wait())?.gasUsed) - 21000;
        gasCumulative += BigInt(gasUsed);
        const res = await contract.getFee();

        records.push({
          timestamp: Number(swap.timestamp),
          tick: Number(swap.tick),
          fee: Number(res.fee),
          volatilityAverage: res.volatilityAverage.toString(),
          tickAverage: Number(res.averageTick),
          gasUsed: gasUsed.toString(),
        });
      }
      lastTick = swap.tick;
      i++;
      if (Math.floor(i / 1000) != packNum) {
        const timeNow = Math.floor(Date.now() / 1000);
        packNum = Math.floor(i / 1000);
        const speed = i / (timeNow - startTime);
        const timeEstimation = Math.floor((events.length - i) / (speed > 0 ? speed : 1));
        const estimatedHours = Math.floor(timeEstimation / (60 * 60));
        const estimatedMinutes = Math.floor((timeEstimation % (60 * 60)) / 60);
        const estimatedSeconds = Math.floor((timeEstimation % (60 * 60)) % 60);
        const avgGas = gasCumulative / BigInt(i);
        console.log(`Done ${i} / ${events.length}, avg gas: ${avgGas}, est time: ${estimatedHours}:${estimatedMinutes}:${estimatedSeconds}`);

        if (timeNow - startTime > timeout) {
          console.log(`Finishing by timeout: ${i} \ ${events.length}`);
          break;
        }
      }
    } catch (e) {
      console.log('ERROR', e);
      break;
    }
  }

  console.log('Done!');
  fs.writeFileSync(path.resolve(__dirname, 'simulationResult.json'), JSON.stringify(records));
}

doSimulation(5 * 60 * 60)
  .then()
  .catch((x) => console.log('FAILED', x));
