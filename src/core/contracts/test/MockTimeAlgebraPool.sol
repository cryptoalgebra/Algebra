// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../AlgebraPool.sol';

// used for testing time dependent behavior
contract MockTimeAlgebraPool is AlgebraPool {
  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  uint256 public time = 1601906400;

  function setTotalFeeGrowth0Token(uint256 _totalFeeGrowth0Token) external {
    totalFeeGrowth0Token = _totalFeeGrowth0Token;
  }

  function setTotalFeeGrowth1Token(uint256 _totalFeeGrowth1Token) external {
    totalFeeGrowth1Token = _totalFeeGrowth1Token;
  }

  function advanceTime(uint256 by) external {
    unchecked {
      time += by;
    }
  }

  function _blockTimestamp() internal view override returns (uint32) {
    unchecked {
      return uint32(time);
    }
  }

  function checkBlockTimestamp() external view returns (bool) {
    require(super._blockTimestamp() == uint32(block.timestamp));
    return true;
  }

  function getKeyForPosition(address owner, int24 bottomTick, int24 topTick) external pure returns (bytes32 key) {
    assembly {
      key := or(shl(24, or(shl(24, owner), and(bottomTick, 0xFFFFFF))), and(topTick, 0xFFFFFF))
    }
  }

  function getKeyForLimitPosition(address owner, int24 tick) external pure returns (bytes32 key) {
    assembly {
      key := or(shl(24, owner), and(tick, 0xFFFFFF))
    }
  }
}
