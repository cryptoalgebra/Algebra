// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../modules/OracleModule.sol';

contract MockTimeOracleModule is OracleModule {
    using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

    // Monday, October 5, 2020 9:00:00 AM GMT-05:00
    uint256 public time = 1601906400;

    constructor(address _modularHub) OracleModule(_modularHub) {}

    function advanceTime(uint256 by) external {
        unchecked {
            time += by;
        }
    }

    function _blockTimestamp() internal view override returns (uint32) {
        return uint32(time);
    }

    struct UpdateParams {
        uint32 advanceTimeBy;
        int24 tick;
    }

    function batchUpdate(UpdateParams[] calldata params) external {
        // sload everything
        uint16 _index = timepointIndex;
        uint32 _time = lastTimepointTimestamp;
        int24 _tick;
        unchecked {
            for (uint256 i; i < params.length; ++i) {
                _time += params[i].advanceTimeBy;
                _tick = params[i].tick;
                (_index, ) = timepoints.write(_index, _time, _tick);
            }
        }

        // sstore everything
        lastTimepointTimestamp = _time;
        timepointIndex = _index;
        time = _time;
    }

    function checkBlockTimestamp() external view returns (bool) {
        require(super._blockTimestamp() == uint32(block.timestamp));
        return true;
    }
}
