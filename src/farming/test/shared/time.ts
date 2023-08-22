import { log } from './logging';
import { time } from '@nomicfoundation/hardhat-network-helpers';

type TimeSetterFunction = (timestamp: number) => Promise<void>;

type TimeSetters = {
  set: TimeSetterFunction;
  step: TimeSetterFunction;
  setAndMine: TimeSetterFunction;
};

export const createTimeMachine = (): TimeSetters => {
  return {
    set: async (timestamp: number) => {
      log.debug(`🕒 setTime(${timestamp})`);
      // Not sure if I need both of those
      await time.setNextBlockTimestamp(timestamp);
    },

    step: async (interval: number) => {
      log.debug(`🕒 increaseTime(${interval})`);
      await time.increase(interval);
    },

    setAndMine: async (timestamp: number) => {
      await time.increaseTo(timestamp);
    },
  };
};
