// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface IAlgebraVirtualPool {
  enum Status {
    NOT_EXIST,
    ACTIVE,
    NOT_STARTED
  }

  /**
   * @dev This function is called by the main pool when an initialized tick is crossed there.
   * If the tick is also initialized in a virtual pool it should be crossed too
   * @param nextTick The crossed tick
   * @param zeroToOne The direction
   */
  function cross(int24 nextTick, bool zeroToOne) external;

  /**
   * @dev This function is called from the main pool before every swap To increase seconds per liquidity
   * cumulative considering previous timestamp and liquidity. The liquidity is stored in a virtual pool
   * @param currentTimestamp The timestamp of the current swap
   * @return Status The status of virtual pool
   */
  function increaseCumulative(uint32 currentTimestamp) external returns (Status);
}
