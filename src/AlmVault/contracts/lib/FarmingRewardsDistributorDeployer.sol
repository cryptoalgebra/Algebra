// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {FarmingRewardsDistributor} from '../FarmingRewardsDistributor.sol';

library FarmingRewardsDistributorDeployer {
  function createFarmingRewardsDistributor(address algebraVault) public returns (address farmingRewardsDistributor) {
    farmingRewardsDistributor = address(new FarmingRewardsDistributor(algebraVault));
  }
}
