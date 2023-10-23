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
      // Not sure if I need both of those
      await time.setNextBlockTimestamp(timestamp);
    },

    step: async (interval: number) => {
      await time.increase(interval);
    },

    setAndMine: async (timestamp: number) => {
      await time.increaseTo(timestamp);
    },
  };
};
