// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '../modules/DynamicFeeModule.sol';

contract MockTimeDynamicFeeModule is DynamicFeeModule {
    // Monday, October 5, 2020 9:00:00 AM GMT-05:00
    uint256 public time = 1601906400;

    constructor(address _factory, address _pluginFactory, address _oracleModule, address _modularHub)
        DynamicFeeModule (_factory, _pluginFactory, _oracleModule, _modularHub) 
    {}

    function advanceTime(uint256 by) external {
        unchecked {
            time += by;
        }
    }

    function _blockTimestamp() internal view override returns (uint32) {
        return uint32(time);
    }
}
