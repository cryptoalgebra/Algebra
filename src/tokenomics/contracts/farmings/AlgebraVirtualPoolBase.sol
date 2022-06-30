// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/TickManager.sol';

import './IAlgebraVirtualPoolBase.sol';

abstract contract AlgebraVirtualPoolBase is IAlgebraVirtualPoolBase {
    address public immutable farmingCenterAddress;
    address public immutable farmingAddress;
    address public immutable pool;

    // @inheritdoc IAlgebraVirtualPoolBase
    uint32 public override timeOutside;

    // @inheritdoc IAlgebraVirtualPoolBase
    mapping(int24 => TickManager.Tick) public override ticks;

    mapping(int16 => uint256) internal tickTable;

    // @inheritdoc IAlgebraVirtualPoolBase
    uint128 public override prevLiquidity;
    // @inheritdoc IAlgebraVirtualPoolBase
    uint128 public override currentLiquidity;
    // @inheritdoc IAlgebraVirtualPoolBase
    int24 public override globalTick;

    // @inheritdoc IAlgebraVirtualPoolBase
    uint160 public override globalSecondsPerLiquidityCumulative;
    // @inheritdoc IAlgebraVirtualPoolBase
    uint32 public override prevTimestamp;

    /// @notice only pool (or FarmingCenter as "proxy") can call
    modifier onlyFromPool() {
        require(msg.sender == farmingCenterAddress || msg.sender == pool, 'only pool can call this function');
        _;
    }

    modifier onlyFarming() {
        require(msg.sender == farmingAddress, 'only farming can call this function');
        _;
    }

    constructor(
        address _farmingCenterAddress,
        address _farmingAddress,
        address _pool
    ) {
        farmingCenterAddress = _farmingCenterAddress;
        farmingAddress = _farmingAddress;
        pool = _pool;
    }

    // @inheritdoc IAlgebraVirtualPool
    function processSwap() external override onlyFromPool {
        prevLiquidity = currentLiquidity;
    }
}
