// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/alm-vault/contracts/interfaces/IAlgebraVault.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import '@openzeppelin/contracts/utils/math/Math.sol';

import '../interfaces/IRebalanceManager.sol';

import './AlgebraBasePlugin.sol';

abstract contract BaseRebalanceManager is IRebalanceManager, Timestamp {
  bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');

  struct TwapResult {
    uint256 currentPriceAccountingDecimals;
    uint256 slowAvgPriceAccountingDecimals;
    uint256 fastAvgPriceAccountingDecimals;
    uint256 totalPairedInDeposit;
    uint256 totalDepositToken;
    uint256 totalPairedToken;
    int24 currentTick;
    uint16 percentageOfDepositTokenUnused; // 10000 = 100%
    uint16 percentageOfDepositToken; // 10000 = 100%
    bool sameBlock;
  }

  struct Ranges {
    int24 baseLower;
    int24 baseUpper;
    int24 limitLower;
    int24 limitUpper;
  }

  enum State {
    OverInventory,
    Normal,
    UnderInventory,
    Special
  }

  enum DecideStatus {
    Normal,
    Special,
    NoNeed,
    TooSoon,
    NoNeedWithPending,
    ExtremeVolatility
  }

  struct Thresholds {
    uint16 depositTokenUnusedThreshold;
    uint16 simulate;
    uint16 normalThreshold;
    uint16 underInventoryThreshold;
    uint16 overInventoryThreshold;
    uint16 priceChangeThreshold;
    uint16 extremeVolatility;
    uint16 highVolatility;
    uint16 someVolatility;
    uint16 dtrDelta;
    uint16 baseLowPct;
    uint16 baseHighPct;
    uint16 limitReservePct;
  }

  address public vault;
  bool public paused;
  bool public allowToken1;
  State public state;
  uint32 public lastRebalanceTimestamp;
  uint256 public lastRebalanceCurrentPrice;
  Thresholds public thresholds;

  address public pairedToken;
  uint8 public pairedTokenDecimals;
  address public depositToken;
  uint8 public depositTokenDecimals;
  uint8 public decimalsSum;
  uint8 public tokenDecimals;
  int24 public tickSpacing;
  address public factory;
  address public pool;
  uint32 public minTimeBetweenRebalances;

  function setPriceChangeThreshold(uint16 _priceChangeThreshold) external {
    _authorize();
    require(_priceChangeThreshold < 10000, 'Invalid price change threshold');
    thresholds.priceChangeThreshold = _priceChangeThreshold;
    emit SetPriceChangeThreshold(_priceChangeThreshold);
  }

  function setPercentages(uint16 _baseLowPct, uint16 _baseHighPct, uint16 _limitReservePct) external {
    _authorize();
    require(_baseLowPct >= 100 && _baseLowPct <= 10000, 'Invalid base low percent');
    require(_baseHighPct >= 100 && _baseHighPct <= 10000, 'Invalid base high percent');
    require(_limitReservePct >= 100 && _limitReservePct <= 10000 - thresholds.simulate, 'Invalid limit reserve percent');
    thresholds.baseLowPct = _baseLowPct;
    thresholds.baseHighPct = _baseHighPct;
    thresholds.limitReservePct = _limitReservePct;
    emit SetPercentages(_baseLowPct, _baseHighPct, _limitReservePct);
  }

  function setTriggers(uint16 _simulate, uint16 _normalThreshold, uint16 _underInventoryThreshold, uint16 _overInventoryThreshold) external {
    _authorize();
    require(_underInventoryThreshold > 6000, '_underInventoryThreshold must be > 6000');
    require(_normalThreshold > _underInventoryThreshold, '_normalThreshold must be > _underInventoryThreshold');
    require(_overInventoryThreshold > _normalThreshold, '_overInventoryThreshold must be > _normalThreshold');
    require(_simulate > _overInventoryThreshold, 'Simulate must be > _overInventoryThreshold');
    require(_simulate < 9500, 'Simulate must be < 9500');
    thresholds.simulate = _simulate;
    thresholds.normalThreshold = _normalThreshold;
    thresholds.underInventoryThreshold = _underInventoryThreshold;
    thresholds.overInventoryThreshold = _overInventoryThreshold;
    emit SetTriggers(_simulate, _normalThreshold, _underInventoryThreshold, _overInventoryThreshold);
  }

  function setDtrDelta(uint16 _dtrDelta) external {
    _authorize();
    require(_dtrDelta <= 10000, '_dtrDelta must be <= 10000');
    thresholds.dtrDelta = _dtrDelta;
    emit SetDtrDelta(_dtrDelta);
  }

  function setHighVolatility(uint16 _highVolatility) external {
    _authorize();
    require(_highVolatility >= thresholds.someVolatility, '_highVolatility must be >= someVolatility');
    thresholds.highVolatility = _highVolatility;
    emit SetHighVolatility(_highVolatility);
  }

  function setSomeVolatility(uint16 _someVolatility) external {
    _authorize();
    require(_someVolatility <= 300, '_someVolatility must be <= 300');
    thresholds.someVolatility = _someVolatility;
    emit SetSomeVolatility(_someVolatility);
  }

  function setExtremeVolatility(uint16 _extremeVolatility) external {
    _authorize();
    require(_extremeVolatility >= thresholds.highVolatility, '_extremeVolatility must be >= highVolatility');
    thresholds.extremeVolatility = _extremeVolatility;
    emit SetExtremeVolatility(_extremeVolatility);
  }

  function setDepositTokenUnusedThreshold(uint16 _depositTokenUnusedThreshold) external {
    _authorize();
    require(
      _depositTokenUnusedThreshold >= 100 && _depositTokenUnusedThreshold <= 10000,
      '_depositTokenUnusedThreshold must be 100 <= _depositTokenUnusedThreshold <= 10000'
    );
    thresholds.depositTokenUnusedThreshold = _depositTokenUnusedThreshold;
    emit SetDepositTokenUnusedThreshold(_depositTokenUnusedThreshold);
  }

  function setMinTimeBetweenRebalances(uint32 _minTimeBetweenRebalances) external {
    _authorize();
    minTimeBetweenRebalances = _minTimeBetweenRebalances;
    emit SetMinTimeBetweenRebalances(_minTimeBetweenRebalances);
  }

  function setVault(address _vault) external {
    _authorize();
    vault = _vault;
    emit SetVault(_vault);
  }

  function unpause() external {
    _authorize();
    require(paused, 'Already unpaused');
    paused = false;
    emit Unpaused();
  }

  function obtainTWAPAndRebalance(int24 currentTick, int24 slowTwapTick, int24 fastTwapTick, uint32 lastBlockTimestamp) external {
    require(msg.sender == IAlgebraPool(pool).plugin(), 'Should only called by plugin');
    if (vault == address(0)) return;
    TwapResult memory twapResult = _obtainTWAPs(currentTick, slowTwapTick, fastTwapTick, lastBlockTimestamp);
    _rebalance(twapResult);
  }

  function _rebalance(TwapResult memory obtainTWAPsResult) internal {
    if (paused) return;
    if (obtainTWAPsResult.totalDepositToken + obtainTWAPsResult.totalPairedInDeposit == 0) return;
    if (
      obtainTWAPsResult.currentPriceAccountingDecimals == 0 ||
      obtainTWAPsResult.slowAvgPriceAccountingDecimals == 0 ||
      obtainTWAPsResult.fastAvgPriceAccountingDecimals == 0
    ) return;

    (DecideStatus decideStatus, State newState) = _decideRebalance(obtainTWAPsResult);

    if (decideStatus == DecideStatus.NoNeed || decideStatus == DecideStatus.TooSoon) return;

    if (decideStatus != DecideStatus.NoNeedWithPending) {
      if (decideStatus != DecideStatus.ExtremeVolatility) {
        Ranges memory ranges;
        if (decideStatus == DecideStatus.Normal) {
          if (
            obtainTWAPsResult.currentPriceAccountingDecimals == 0 ||
            obtainTWAPsResult.totalDepositToken == 0 ||
            (newState == State.Normal &&
              obtainTWAPsResult.totalPairedInDeposit <=
              _calcPart(obtainTWAPsResult.totalDepositToken + obtainTWAPsResult.totalPairedInDeposit, thresholds.limitReservePct))
          ) return;
          ranges = _getRangesWithState(newState, obtainTWAPsResult);
        } else {
          ranges = _getRangesWithoutState(obtainTWAPsResult);
        }

        if (ranges.baseUpper - ranges.baseLower <= 300 || ranges.limitUpper - ranges.limitLower <= 300) return;

        require(gasleft() >= 1600000, 'Not enough gas left');
        try IAlgebraVault(vault).rebalance(ranges.baseLower, ranges.baseUpper, ranges.limitLower, ranges.limitUpper, 0) {
          lastRebalanceTimestamp = _blockTimestamp();
          lastRebalanceCurrentPrice = obtainTWAPsResult.currentPriceAccountingDecimals;
          state = newState;
        } catch {
          state = State.Special;
          _pause();
        }
      } else {
        IAlgebraVault(vault).setDepositMax(0, 0);
        state = State.Special;
        _pause();
      }
    } else {
      lastRebalanceTimestamp = _blockTimestamp();
      lastRebalanceCurrentPrice = obtainTWAPsResult.currentPriceAccountingDecimals;
    }
  }

  function _obtainTWAPs(
    int24 currentTick,
    int24 slowTwapTick,
    int24 fastTwapTick,
    uint32 lastBlockTimestamp
  ) internal view returns (TwapResult memory twapResult) {
    twapResult.currentTick = currentTick;
    twapResult.sameBlock = _blockTimestamp() == lastBlockTimestamp;
    bool _allowToken1 = allowToken1;

    if (_allowToken1) {
      (uint256 amount0, uint256 amount1) = IAlgebraVault(vault).getTotalAmounts();
      twapResult.totalPairedToken = amount0;
      twapResult.totalDepositToken = amount1;
    } else {
      (uint256 amount0, uint256 amount1) = IAlgebraVault(vault).getTotalAmounts();
      twapResult.totalPairedToken = amount1;
      twapResult.totalDepositToken = amount0;
    }

    address _depositToken = depositToken;
    address _pairedToken = pairedToken;

    uint8 _pairedTokenDecimals = pairedTokenDecimals;

    (uint256 slowPrice, uint256 fastPrice, uint256 currentPriceAccountingDecimals) = _getTwapPrices(
      _depositToken,
      _pairedToken,
      _pairedTokenDecimals,
      slowTwapTick,
      fastTwapTick,
      twapResult.currentTick
    );
    twapResult.slowAvgPriceAccountingDecimals = slowPrice;
    twapResult.fastAvgPriceAccountingDecimals = fastPrice;

    twapResult.currentPriceAccountingDecimals = currentPriceAccountingDecimals;
    uint256 totalPairedInDepositWithDecimals = currentPriceAccountingDecimals * twapResult.totalPairedToken;
    uint256 totalPairedInDeposit = totalPairedInDepositWithDecimals / (10 ** _pairedTokenDecimals);
    twapResult.totalPairedInDeposit = totalPairedInDeposit;

    if (totalPairedInDeposit == 0) {
      twapResult.percentageOfDepositToken = 10000;
    } else {
      uint256 totalTokensAmount = twapResult.totalDepositToken + twapResult.totalPairedInDeposit;
      uint16 percentageOfDepositToken = uint16((twapResult.totalDepositToken * 10000) / totalTokensAmount);
      twapResult.percentageOfDepositToken = percentageOfDepositToken;
    }

    uint256 depositTokenBalance = _getDepositTokenVaultBalance();

    if (depositTokenBalance > 0) {
      uint256 totalTokensAmount = twapResult.totalDepositToken + twapResult.totalPairedInDeposit;
      twapResult.percentageOfDepositTokenUnused = uint16((depositTokenBalance * 10000) / totalTokensAmount);
    } else {
      twapResult.percentageOfDepositTokenUnused = 0;
    }
  }

  function _decideRebalance(TwapResult memory twapResult) internal virtual returns (DecideStatus, State) {
    uint256 fastSlowDiff = _calcPercentageDiff(twapResult.fastAvgPriceAccountingDecimals, twapResult.slowAvgPriceAccountingDecimals);
    uint256 fastCurrentDiff = _calcPercentageDiff(twapResult.fastAvgPriceAccountingDecimals, twapResult.currentPriceAccountingDecimals);

    bool isExtremeVolatility = fastSlowDiff >= thresholds.extremeVolatility || fastCurrentDiff >= thresholds.extremeVolatility;
    if (!isExtremeVolatility) {
      bool isHighVolatility = fastSlowDiff >= thresholds.highVolatility || fastCurrentDiff >= thresholds.highVolatility;
      if (!isHighVolatility) {
        if (
          !((state == State.OverInventory || state == State.Normal) &&
            lastRebalanceCurrentPrice != 0 &&
            twapResult.percentageOfDepositToken < thresholds.underInventoryThreshold - thresholds.dtrDelta)
        ) {
          if (_blockTimestamp() < lastRebalanceTimestamp + minTimeBetweenRebalances) {
            return (DecideStatus.TooSoon, State.Special);
          }

          (bool needToRebalance, State newState) = _updateStatus(twapResult);
          if (needToRebalance) {
            if (fastCurrentDiff < thresholds.someVolatility) {
              return (DecideStatus.Normal, newState); // normal rebalance
            } else {
              return (DecideStatus.TooSoon, newState); // too soon
            }
          } else {
            return (DecideStatus.NoNeedWithPending, newState); // when twapResult.percentageOfToken1 is less than 1%
          }
        }
      } else {
        // handle high volatility
        if (state != State.Special) {
          if (fastCurrentDiff >= thresholds.someVolatility && twapResult.sameBlock) {
            return (DecideStatus.TooSoon, State.Special);
          }
        } else {
          // special -> noneed
          return (DecideStatus.NoNeed, State.Special);
        }
      }
      // high volatility, fastSlowDiff >= thresholds.highVolatility
      state = State.Special;
      return (DecideStatus.Special, State.Special);
    } else {
      return (DecideStatus.ExtremeVolatility, State.Special);
    }
  }

  function _updateStatus(TwapResult memory twapResult) internal virtual returns (bool, State) {
    if (state != State.Special && lastRebalanceCurrentPrice != 0) {
      if (state != State.Normal) {
        if (state != State.OverInventory) {
          if (twapResult.percentageOfDepositToken <= thresholds.simulate) {
            if (twapResult.percentageOfDepositToken >= thresholds.normalThreshold) {
              return (true, State.Normal);
            }
          } else {
            return (true, State.OverInventory);
          }
        } else if (twapResult.percentageOfDepositToken >= thresholds.underInventoryThreshold) {
          if (twapResult.percentageOfDepositToken <= thresholds.overInventoryThreshold) {
            return (true, State.Normal);
          }
        } else {
          return (true, State.UnderInventory);
        }

        uint256 priceChange = _calcPercentageDiff(lastRebalanceCurrentPrice, twapResult.currentPriceAccountingDecimals); // percentage diff between lastRebalanceCurrentPrice and currentPriceAccountingDecimals
        if (priceChange > thresholds.priceChangeThreshold) {
          return (true, state);
        }
      } else if (twapResult.percentageOfDepositToken <= thresholds.simulate) {
        if (twapResult.percentageOfDepositToken < thresholds.underInventoryThreshold) {
          return (true, State.UnderInventory);
        }
      } else {
        return (true, State.OverInventory);
      }

      if (twapResult.percentageOfDepositTokenUnused <= thresholds.depositTokenUnusedThreshold) {
        return (false, State.Normal); // no rebalance needed
      } else {
        return (true, state);
      }
    } else {
      if (twapResult.percentageOfDepositToken <= thresholds.simulate) {
        if (twapResult.percentageOfDepositToken >= thresholds.underInventoryThreshold) {
          return (true, State.Normal);
        } else {
          return (true, State.UnderInventory);
        }
      } else {
        return (true, State.OverInventory);
      }
    }
  }

  function _getRangesWithState(State newState, TwapResult memory twapResult) internal view returns (Ranges memory ranges) {
    // scope to prevent stack too deep
    {
      bool _allowToken1 = allowToken1;
      int24 _tickSpacing = tickSpacing;
      uint8 _tokenDecimals = tokenDecimals;

      (uint256 upperPriceBound, uint256 targetPrice, uint256 lowerPriceBound) = _getPriceBounds(newState, twapResult, _allowToken1);
      int24 roundedTick = roundTickToTickSpacing(_tickSpacing, twapResult.currentTick);
      bool currentTickIsRound = roundedTick == twapResult.currentTick;

      int24 commonTick;
      int24 tickForLowerPrice;
      if (newState == State.Normal) {
        int24 targetTick = getTickAtPrice(_tokenDecimals, targetPrice);
        commonTick = roundTickToTickSpacingConsideringNegative(_tickSpacing, targetTick);
      } else {
        commonTick = roundTickToTickSpacingConsideringNegative(_tickSpacing, twapResult.currentTick);
      }

      int24 upperTick = getTickAtPrice(_tokenDecimals, upperPriceBound);
      int24 tickForHigherPrice = roundTickToTickSpacingConsideringNegative(_tickSpacing, upperTick);

      if (lowerPriceBound == 0) {
        int24 lowerTick = _allowToken1 ? TickMath.MIN_TICK : TickMath.MAX_TICK;
        tickForLowerPrice = (lowerTick / _tickSpacing) * _tickSpacing; // adjust to tick spacing
      } else {
        int24 lowerTick = getTickAtPrice(_tokenDecimals, lowerPriceBound);
        tickForLowerPrice = roundTickToTickSpacingConsideringNegative(_tickSpacing, lowerTick);
      }
      if (!_allowToken1) {
        ranges.baseLower = int24(commonTick);
        ranges.baseUpper = int24(tickForLowerPrice);
        ranges.limitLower = int24(tickForHigherPrice);
        ranges.limitUpper = int24(commonTick);

        if (newState != State.UnderInventory) {
          int24 roundedMinTick = roundTickToTickSpacing(_tickSpacing, TickMath.MIN_TICK);
          ranges.limitLower = int24(roundedMinTick); // use MIN tick
        } else {
          ranges.baseLower = currentTickIsRound ? twapResult.currentTick : ranges.baseLower;
          ranges.limitUpper = currentTickIsRound ? twapResult.currentTick - _tickSpacing : ranges.limitUpper;
        }

        if (newState == State.OverInventory) {
          ranges.limitUpper = currentTickIsRound ? twapResult.currentTick : _tickSpacing + ranges.limitUpper;
          ranges.baseLower = currentTickIsRound ? _tickSpacing + twapResult.currentTick : _tickSpacing + ranges.baseLower;
          ranges.baseUpper = int24(ranges.baseUpper + _tickSpacing);
        }
      } else {
        ranges.baseLower = int24(tickForLowerPrice);
        ranges.baseUpper = int24(commonTick);
        ranges.limitLower = int24(commonTick);
        ranges.limitUpper = int24(tickForHigherPrice);

        if (newState != State.UnderInventory) {
          ranges.limitUpper = roundTickToTickSpacing(_tickSpacing, TickMath.MAX_TICK);
        }

        if (lowerPriceBound > 0 && newState != State.OverInventory) {
          ranges.baseLower = int24(ranges.baseLower + _tickSpacing);
        }

        if (newState == State.Normal) {
          ranges.baseUpper = int24(_tickSpacing + ranges.baseUpper);
          ranges.limitLower = int24(_tickSpacing + ranges.limitLower);
        }

        if (newState == State.UnderInventory) {
          ranges.baseUpper = currentTickIsRound ? twapResult.currentTick : _tickSpacing + ranges.baseUpper;
          ranges.limitLower = currentTickIsRound ? _tickSpacing + twapResult.currentTick : _tickSpacing + ranges.limitLower;
        }

        if (newState == State.OverInventory) {
          ranges.baseUpper = currentTickIsRound ? twapResult.currentTick - _tickSpacing : ranges.baseUpper;
          ranges.limitLower = currentTickIsRound ? twapResult.currentTick : ranges.limitLower;
        }
      }
    }

    if (newState == State.OverInventory) {
      (ranges.baseLower, ranges.baseUpper, ranges.limitLower, ranges.limitUpper) = (
        ranges.limitLower,
        ranges.limitUpper,
        ranges.baseLower,
        ranges.baseUpper
      );
    }
  }

  function _getRangesWithoutState(TwapResult memory twapResult) internal view returns (Ranges memory ranges) {
    int24 _tickSpacing = tickSpacing;
    bool _allowToken1 = allowToken1;

    int24 tickRoundedDown = roundTickToTickSpacingConsideringNegative(_tickSpacing, twapResult.currentTick);
    int24 tickRounded = roundTickToTickSpacing(_tickSpacing, twapResult.currentTick);

    if (!_allowToken1) {
      if (twapResult.currentTick == tickRounded) {
        tickRoundedDown = twapResult.currentTick;
      }

      ranges.baseLower = tickRoundedDown;
      int24 maxTickRounded = roundTickToTickSpacing(_tickSpacing, TickMath.MAX_TICK); // round MaxUpperTick
      ranges.baseUpper = maxTickRounded;
      int24 minTickRounded = roundTickToTickSpacing(_tickSpacing, TickMath.MIN_TICK); // round MinLowerTick
      ranges.limitLower = minTickRounded;
      if (twapResult.currentTick == tickRounded) {
        tickRoundedDown = twapResult.currentTick - _tickSpacing;
      }
      ranges.limitUpper = tickRoundedDown;
    } else {
      int24 minTickRounded = roundTickToTickSpacing(_tickSpacing, TickMath.MIN_TICK);
      ranges.baseLower = minTickRounded;

      if (twapResult.currentTick == tickRounded) {
        ranges.baseUpper = twapResult.currentTick;
      } else {
        ranges.baseUpper = tickRoundedDown + _tickSpacing;
      }

      if (twapResult.currentTick == tickRounded) {
        ranges.limitLower = _tickSpacing + twapResult.currentTick;
      } else {
        ranges.limitLower = tickRoundedDown + _tickSpacing;
      }
      int24 maxTickRounded = roundTickToTickSpacing(_tickSpacing, TickMath.MAX_TICK); // round MaxUpperTick
      ranges.limitUpper = maxTickRounded;
    }
  }

  function _getPriceAccountingDecimals(
    address token0,
    address token1,
    uint128 _pairedTokenDecimals,
    int24 averageTick
  ) private pure returns (uint256 price) {
    uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(averageTick);
    if (uint160(sqrtPriceX96) > type(uint128).max) {
      uint256 priceX128 = FullMath.mulDiv(uint160(sqrtPriceX96), uint160(sqrtPriceX96), uint256(type(uint64).max) + 1);
      return
        token1 < token0
          ? FullMath.mulDiv(priceX128, _pairedTokenDecimals, uint256(type(uint128).max) + 1)
          : FullMath.mulDiv(uint256(type(uint128).max) + 1, _pairedTokenDecimals, priceX128);
    } else {
      return
        token1 < token0
          ? FullMath.mulDiv(uint256(sqrtPriceX96) * uint256(sqrtPriceX96), _pairedTokenDecimals, uint256(type(uint192).max) + 1)
          : FullMath.mulDiv(uint256(type(uint192).max) + 1, _pairedTokenDecimals, uint256(sqrtPriceX96) * uint256(sqrtPriceX96));
    }
  }

  function _authorize() internal view {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
  }

  function _getTwapPrices(
    address _depositToken,
    address _pairedToken,
    uint8 _pairedTokenDecimals,
    int24 slowTwapTick,
    int24 fastTwapTick,
    int24 currentTick
  ) internal view virtual returns (uint256, uint256, uint256) {
    return (
      _getPriceAccountingDecimals(_depositToken, _pairedToken, uint128(10 ** _pairedTokenDecimals), slowTwapTick),
      _getPriceAccountingDecimals(_depositToken, _pairedToken, uint128(10 ** _pairedTokenDecimals), fastTwapTick),
      _getPriceAccountingDecimals(_depositToken, _pairedToken, uint128(10 ** _pairedTokenDecimals), currentTick)
    );
  }

  function _getPairedTokenDecimals() internal view virtual returns (uint8) {
    return IERC20Metadata(pairedToken).decimals();
  }

  function _getDepositTokenDecimals() internal view virtual returns (uint8) {
    return IERC20Metadata(depositToken).decimals();
  }

  function _getDepositTokenVaultBalance() internal view virtual returns (uint256) {
    return IERC20Metadata(depositToken).balanceOf(vault);
  }

  function _calcPercentageDiff(uint256 a, uint256 b) private pure returns (uint256) {
    return b > a ? ((b - a) * 10000) / b : ((a - b) * 10000) / a;
  }

  function roundTickToTickSpacing(int24 _tickSpacing, int24 _tick) private pure returns (int24) {
    return (_tick / _tickSpacing) * _tickSpacing;
  }

  function roundTickToTickSpacingConsideringNegative(int24 _tickSpacing, int24 _tick) private pure returns (int24) {
    int24 roundedTick = roundTickToTickSpacing(_tickSpacing, _tick);
    if (_tick < 0) {
      return roundedTick - _tickSpacing;
    } else {
      return roundedTick;
    }
  }

  //                                                                                                                                                                    upper             target    lower
  function _getPriceBounds(State _state, TwapResult memory twapResult, bool _allowToken1) private view returns (uint256, uint256, uint256) {
    uint256 targetPrice = twapResult.currentPriceAccountingDecimals;

    uint256 lowerPriceBound = 0;
    if (_state != State.UnderInventory) {
      lowerPriceBound = targetPrice - _calcPart(thresholds.baseLowPct, targetPrice);
    }
    uint256 upperPriceBound = targetPrice + _calcPart(thresholds.baseHighPct, targetPrice);

    if (_state == State.Normal) {
      uint256 totalTokens = twapResult.totalDepositToken + twapResult.totalPairedInDeposit;
      uint256 partOfTotalTokens = _calcPart(totalTokens, thresholds.limitReservePct); // 5% of totalTokensInToken0
      uint256 excess = twapResult.totalPairedInDeposit - partOfTotalTokens;
      uint256 partOfExcess = excess * thresholds.baseLowPct;
      uint256 excessCoef = partOfExcess / twapResult.totalDepositToken;
      if (excessCoef != 0) {
        targetPrice += _calcPart(excessCoef, targetPrice);
      }
    }

    if (!_allowToken1) {
      targetPrice = _removeDecimals(targetPrice, decimalsSum);
      lowerPriceBound = _removeDecimals(lowerPriceBound, decimalsSum);
      upperPriceBound = _removeDecimals(upperPriceBound, decimalsSum);
    }

    return (upperPriceBound, targetPrice, lowerPriceBound);
  }

  function _calcPart(uint256 base, uint256 part) private pure returns (uint256) {
    return (base * part) / 10000;
  }

  function _removeDecimals(uint256 amount, uint8 decimals) private pure returns (uint256) {
    return amount != 0 ? (10 ** decimals) / amount : amount;
  }

  function _pause() private {
    paused = true;
    emit Paused();
  }

  function getTickAtPrice(uint8 _tokenDecimals, uint256 _price) private pure returns (int24) {
    uint160 sqrtPriceX96 = getSqrtPriceX96(_tokenDecimals, _price);
    return TickMath.getTickAtSqrtRatio(sqrtPriceX96);
  }

  function getSqrtPriceX96(uint8 _tokenDecimals, uint256 _price) private pure returns (uint160) {
    return
      _price >= 10 ** _tokenDecimals
        ? getSqrtPriceX96FromPriceWithDecimals(_tokenDecimals, _price)
        : getSqrtPriceX96FromPriceWithoutDecimals(_tokenDecimals, _price);
  }

  function getSqrtPriceX96FromPriceWithDecimals(uint8 _tokenDecimals, uint256 _price) private pure returns (uint160) {
    return uint160((Math.sqrt(_price) << 96) / Math.sqrt(10 ** _tokenDecimals));
  }

  function getSqrtPriceX96FromPriceWithoutDecimals(uint8 _tokenDecimals, uint256 _price) private pure returns (uint160) {
    return uint160(Math.sqrt((_price << 192) / 10 ** _tokenDecimals));
  }

  function _validateThresholds(Thresholds memory _thresholds) internal pure {
    require(_thresholds.priceChangeThreshold < 10000, 'Invalid price change threshold');
    require(_thresholds.underInventoryThreshold > 6000, '_underInventoryThreshold must be > 6000');
    require(_thresholds.normalThreshold > _thresholds.underInventoryThreshold, '_normalThreshold must be > _underInventoryThreshold');
    require(_thresholds.overInventoryThreshold > _thresholds.normalThreshold, '_overInventoryThreshold must be > _normalThreshold');
    require(_thresholds.simulate > _thresholds.overInventoryThreshold, 'Simulate must be > _overInventoryThreshold');
    require(_thresholds.simulate < 9500, 'Simulate must be < 9500');
    require(_thresholds.baseLowPct >= 100 && _thresholds.baseLowPct <= 10000, 'Invalid base low percent');
    require(_thresholds.baseHighPct >= 100 && _thresholds.baseHighPct <= 10000, 'Invalid base high percent');
    require(_thresholds.limitReservePct >= 100 && _thresholds.limitReservePct <= 10000 - _thresholds.simulate, 'Invalid limit reserve percent');
    require(_thresholds.dtrDelta <= 10000, '_dtrDelta must be <= 10000');
    require(_thresholds.highVolatility >= _thresholds.someVolatility, '_highVolatility must be >= someVolatility');
    require(_thresholds.someVolatility <= 300, '_someVolatility must be <= 300');
    require(_thresholds.extremeVolatility >= _thresholds.highVolatility, '_extremeVolatility must be >= highVolatility');
    require(
      _thresholds.depositTokenUnusedThreshold >= 100 && _thresholds.depositTokenUnusedThreshold <= 10000,
      '_depositTokenUnusedThreshold must be 100 <= _depositTokenUnusedThreshold <= 10000'
    );
  }
}
