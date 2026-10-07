// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../../AlgebraPoolExtension.sol';

/// @dev Extension for `PoolMockEchidna`, deployed by the mock itself. Its factory is the mock, which has no
/// `defaultConfigurationForPool`, so the configuration that `initialize` applies is kept here
contract PoolMockEchidnaExtension is AlgebraPoolExtension {
  function _getDefaultConfiguration() internal pure override returns (uint16 _communityFee, int24 _tickSpacing, uint16 _fee) {
    _communityFee = 0;
    _tickSpacing = 1;
    _fee = 100;
  }
}
