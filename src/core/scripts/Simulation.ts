import { ethers, waffle, network } from 'hardhat'
import { BigNumber, Wallet } from 'ethers'
import { TestERC20 } from '../typechain/TestERC20'
import { SimulationTimeAlgebraPool } from '../typechain/SimulationTimeAlgebraPool'
import { SimulationTimePoolDeployer } from "../typechain/SimulationTimePoolDeployer"
import { SimulationTimeFactory } from '../typechain/SimulationTimeFactory'
import {
  createPoolFunctions,
  SwapFunction,
  MintFunction,
  FlashFunction,
  SwapToPriceFunction,
} from '../test/shared/utilities'
import { TestAlgebraCallee } from '../typechain/TestAlgebraCallee'

import * as fs from "fs"
import * as path from "path"
import { MockTimeAlgebraPool } from '../typechain/MockTimeAlgebraPool'

const DAY = 60*60*24;

let wallet: Wallet
let other: Wallet

let token0: TestERC20
let token1: TestERC20

let pool: SimulationTimeAlgebraPool

let swapTarget: TestAlgebraCallee

let swapToLowerPrice: SwapToPriceFunction
let swapToHigherPrice: SwapToPriceFunction
let swapExact0For1: SwapFunction
let swapExact1For0: SwapFunction

let speed: number
let timePassed: number
let currentBlock: number
let numOfBlocks: number
let factory: SimulationTimeFactory

let mint: MintFunction
let flash: FlashFunction

const vaultAddress = '0x1d8b6fA722230153BE08C4Fa4Aa4B4c7cd01A95a'

const PACK_SIZE = 10000; // how many blocks should be in one pack

const FEE_CONFIGURATION = { // can be changed for different fee behavior
  alpha1: 2900,
  alpha2: 15000 - 3000,
  beta1: 360,
  beta2: 60000,
  gamma1: 59,
  gamma2: 8500,
  volumeBeta: 0,
  volumeGamma: 10,
  baseFee: 100
}

let createPool = async (firstToken: any, secondToken:any): Promise<SimulationTimeAlgebraPool> => {
    const poolDeployerFactory = await ethers.getContractFactory('SimulationTimePoolDeployer')
    const poolDeployer = (await poolDeployerFactory.deploy()) as SimulationTimePoolDeployer
    const factoryFactory = await ethers.getContractFactory('SimulationTimeFactory')
    factory = (await factoryFactory.deploy(poolDeployer.address, vaultAddress)) as SimulationTimeFactory
    await poolDeployer.setFactory(factory.address);

    await factory.setBaseFeeConfiguration(
      FEE_CONFIGURATION.alpha1,
      FEE_CONFIGURATION.alpha2,
      FEE_CONFIGURATION.beta1,
      FEE_CONFIGURATION.beta2,
      FEE_CONFIGURATION.gamma1,
      FEE_CONFIGURATION.gamma2,
      FEE_CONFIGURATION.volumeBeta,
      FEE_CONFIGURATION.volumeGamma,
      FEE_CONFIGURATION.baseFee
    )
  
    const poolFactory = await ethers.getContractFactory('SimulationTimeAlgebraPool')
  
    const calleeContractFactory = await ethers.getContractFactory('TestAlgebraCallee')
    swapTarget = (await calleeContractFactory.deploy()) as TestAlgebraCallee
  
    const tx = await factory.createPool(
      firstToken.address,
      secondToken.address
    )
  
    const receipt = await tx.wait()
    const poolAddress = receipt.events?.[1].args?.pool as string
    console.log('Pool: ', poolAddress)
    return poolFactory.attach(poolAddress) as SimulationTimeAlgebraPool
  }

async function deployTokens() {

  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokenA = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
  const tokenB = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20

  [token0, token1] = [tokenA, tokenB].sort((tokenA, tokenB) =>
    tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1
  )

  const [wallet2, other2] = await (ethers as any).getSigners()
  wallet = wallet2;
  other = other2;
}



async function main() {
  await network.provider.send("hardhat_setLoggingEnabled", [false]);
  await network.provider.send("hardhat_setBalance", [
    "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000000000000000",
  ]);
  await deployTokens();
  const blocks = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'AllBlocks_timestamped.json')).toString());
  let fees = [];
  let volats = [];
  let volumesPerLiq = [];
  let ticks = [];
  let uniTicks = [];
  let timestamps = [];
  pool = await createPool(token0, token1);
  ({
    swapToLowerPrice,
    swapToHigherPrice,
    swapExact0For1,
    swapExact1For0,
    mint,
    flash,
  } = createPoolFunctions({
    token0,
    token1,
    swapTarget,
    pool: pool as MockTimeAlgebraPool,
  }))

  await pool.advanceTime(86400000);
  let initialized = false;
  let lastTimestamp = 0;
  numOfBlocks =  blocks.length;
  timePassed = 0;
  let interval = setInterval(() => {
    timePassed += 15
    speed = currentBlock / timePassed;
  }, 15000)

  let lastTick = (await pool.globalState()).tick;
  console.log(wallet.address);
  console.log('Number of blocks: ', blocks.length)
  await network.provider.send("evm_setAutomine", [false]);
  let currentPack = 0;
  for (let blockNum = 0; blockNum < blocks.length; blockNum++) {
    let block = blocks[blockNum]
    //console.log('BLOCK:', blockNum, '|', blocks.length,  block[0].blockNumber)
    //console.log('DATE:', timeConverter(block[0].timestamp))
    //console.log('TIMESTAMP:', block[0].timestamp)
    if (!block[0].timestamp) {
      continue;
    }
    if (lastTimestamp == 0) {
      lastTimestamp = block[0].timestamp
    } else {
      if (lastTimestamp !== block[0].timestamp) {
        await pool.advanceTime(BigNumber.from(block[0].timestamp).sub(BigNumber.from(lastTimestamp)))
        lastTimestamp = block[0].timestamp
      }
    }
    for (let evNum = 0; evNum < block.length; evNum++) {
        let event = block[evNum]
        let values = event.returnValues
        switch(event.event) {
          case "Initialize":
            if (!initialized) {
              await pool.initialize(BigNumber.from(values.price));
              initialized = true;
            }
            break;
          case "Mint":
            if (values.amount < 0) console.log('ERR: MINT', values.amount);
            await mint(wallet.address, values.bottomTick, values.topTick, values.amount)
            break;
          case "Burn":
            if (values.amount < 0) console.log('ERR: BURN', values.amount);
            await pool.burn(values.bottomTick, values.topTick, values.amount, {from: wallet.address})
            break;
          case "Swap":
            if (values.amount0 < 0) {
              if (values.amount1 < 0) console.log('ERR: SWAP 1 -> 0', values.amount1, values.amount0);
              await swapExact1For0(values.amount1, wallet.address);
              // 1 -> 0
            } else {
              // 0 -> 1
              if (values.amount0 < 0) console.log('ERR: SWAP 0 -> 1', values.amount0, values.amount1);
              await swapExact0For1(values.amount0, wallet.address);
            }
            lastTick = values.tick;
            break;
        }
    }
    await network.provider.send("evm_mine", []);

    //console.log('Liq:', (await pool.liquidity()).toString())
    let stats
    try {
      stats = await getStatistics(DAY);
      //console.log('Volt:', stats[0].toString())
      //console.log('V/L:', stats[1].toString())
      //console.log('V/L:', BigNumber.from(stats[1]).div(BigNumber.from(2).pow(BigNumber.from(61))).toString())
      //console.log(BigNumber.from(2).pow(BigNumber.from(64)).toString())
    } catch(e) {
      let now = await pool.getTimepoints([BigNumber.from(0)]);
      stats = [now.volatilityCumulatives[0].div(BigNumber.from(DAY)), 
      now.volumePerAvgLiquiditys[0],
      now.secondsPerLiquidityCumulatives[0]]
      //console.log('Volt:', stats[0].toString())
      //console.log('V/L:', stats[1].toString())
      //console.log('V/L:', BigNumber.from(stats[1]).div(BigNumber.from(2).pow(BigNumber.from(61))).toString())
      //console.log(BigNumber.from(2).pow(BigNumber.from(64)).toString())
    }
    
    //console.log('FEE:', (await pool.globalState()).fee)
    let packNumber = Math.floor(blockNum / PACK_SIZE);
    if (packNumber !== currentPack) {
      let res = {
        fees,
        volats,
        volumesPerLiq,
        ticks,
        timestamps,
        uniTicks
      }
      fs.writeFileSync(path.resolve(__dirname, `results_${currentPack}.json`), JSON.stringify(res));
      currentPack = packNumber;
      fees = [];
      volats = [];
      volumesPerLiq = [];
      ticks = [];
      uniTicks = [];
      timestamps = [];
    }

    let state = await pool.globalState();
    let fee = state.fee;
    fees.push(fee)
    volats.push(stats[0].toString())
    volumesPerLiq.push(stats[1].toString())
    let tick = state.tick
    ticks.push(tick)
    timestamps.push(block[0].timestamp)
    uniTicks.push(lastTick)
    //console.log('===========================================');
    //console.log('\n');
    currentBlock = blockNum;
    printProgress((100*(blockNum/blocks.length)).toFixed(2), timeConverter(block[0].timestamp), fee, stats[0].toString())
  }

  if (currentPack != Math.ceil(blocks.length/PACK_SIZE)) {
    let res = {
      fees,
      volats,
      volumesPerLiq,
      ticks,
      timestamps,
      uniTicks
    }
    fs.writeFileSync(path.resolve(__dirname, `results_${currentPack}.json`), JSON.stringify(res));
  }
  clearInterval(interval);
}


async function getStatistics(time: number) {
  let points = await pool.getTimepoints([BigNumber.from(0), BigNumber.from(time)]);
  return [(points.volatilityCumulatives[0].sub(points.volatilityCumulatives[1]).div(BigNumber.from(DAY))).toString(), 
  (points.volumePerAvgLiquiditys[0].sub(points.volumePerAvgLiquiditys[1])).toString(),
  (points.secondsPerLiquidityCumulatives[0].sub(points.secondsPerLiquidityCumulatives[1])).toString(),
  time]
  
}

function timeConverter(UNIX_timestamp: number){
  var a = new Date(UNIX_timestamp * 1000);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate().toString();
  if (date.length == 1) date = '0' + date;
  var hour = a.getHours().toString();
  if (hour.length == 1) hour = '0' + hour;
  var min = a.getMinutes().toString();
  if (min.length == 1) min = '0' + min;
  var sec = (a.getSeconds()).toString();
  if (sec.length == 1) sec = '0' + sec;
  var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

function printProgress(progress: any, date: any, fee: any, volat: any){
  let time = ((numOfBlocks - currentBlock)/speed);
  let hours = Math.floor(time / (60*60)).toString();
  if (hours.length == 1) hours = '0' + hours;
  let minutes = Math.floor((time % (60*60))/60).toString();
  if (minutes.length == 1) minutes = '0' + minutes;
  let secs = Math.floor((time % (60*60))%60).toString();
  if (secs.length == 1) secs = '0' + secs;

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(progress + '%       '+ date  + '         Fee: ' + fee + '        Time remaining: ' + hours + ':'+minutes+':'+secs  + '     Volat: ' + (volat / 15).toFixed(0) );
}

main().then()