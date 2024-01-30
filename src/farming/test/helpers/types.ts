import { Wallet, Contract, ContractTransactionResponse } from 'ethers';
import { TestERC20 } from '../../typechain';
import { FeeAmount } from '../shared';

export module HelperTypes {
  export type CommandFunction<Input, Output> = (input: Input) => Promise<Output>;

  export module CreateIncentive {
    export type Args = {
      rewardToken: TestERC20;
      bonusRewardToken: TestERC20;
      poolAddress: string;
      nonce: bigint;
      totalReward: bigint;
      bonusReward: bigint;

      rewardRate?: bigint;
      bonusRewardRate?: bigint;
      minimalPositionWidth?: number;
      plugin?: string;
    };
    export type Result = {
      poolAddress: string;
      rewardToken: TestERC20;
      bonusRewardToken: TestERC20;
      bonusReward: bigint;
      totalReward: bigint;
      nonce: bigint;
      virtualPool: Contract;
    };

    export type Command = CommandFunction<Args, Result>;
  }

  export module MintDepositFarm {
    export type Args = {
      lp: Wallet;
      tokensToFarm: [TestERC20, TestERC20];
      amountsToFarm: [bigint, bigint];
      ticks: [number, number];
      createIncentiveResult: CreateIncentive.Result;
    };

    export type Result = {
      lp: Wallet;
      tokenId: string;
      farmdAt: number;
    };

    export type Command = CommandFunction<Args, Result>;
  }

  export module Mint {
    type Args = {
      lp: Wallet;
      tokens: [TestERC20, TestERC20];
      amounts?: [bigint, bigint];
      fee?: FeeAmount;
      tickLower?: number;
      tickUpper?: number;
    };

    export type Result = {
      lp: Wallet;
      tokenId: string;
    };

    export type Command = CommandFunction<Args, Result>;
  }

  export module Deposit {
    type Args = {
      lp: Wallet;
      tokenId: string;
    };
    type Result = void;
    export type Command = CommandFunction<Args, Result>;
  }

  export module exitFarmingCollectBurn {
    type Args = {
      lp: Wallet;
      tokenId: string;
      createIncentiveResult: CreateIncentive.Result;
    };
    export type Result = {
      balance: bigint;
      exitFarmingdAt: number;
    };

    export type Command = CommandFunction<Args, Result>;
  }

  export module EndIncentive {
    type Args = {
      createIncentiveResult: CreateIncentive.Result;
    };

    type Result = {
      amountReturnedToCreator: bigint;
    };

    export type Command = CommandFunction<Args, Result>;
  }

  export module MakeTickGo {
    type Args = {
      direction: 'up' | 'down';
      desiredValue?: number;
      trader?: Wallet;
    };

    type Result = { currentTick: number };

    export type Command = CommandFunction<Args, Result>;
  }

  export module MakeSwapGasCheck {
    type Args = {
      direction: 'up' | 'down';
      desiredValue?: number;
      trader?: Wallet;
      amountIn?: number;
    };

    type Result = ContractTransactionResponse;

    export type Command = CommandFunction<Args, Result>;
  }

  export module GetIncentiveId {
    type Args = CreateIncentive.Result;

    // Returns the incentiveId as bytes32
    type Result = string;

    export type Command = CommandFunction<Args, Result>;
  }
}
