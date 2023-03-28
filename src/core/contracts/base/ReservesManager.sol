// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../libraries/SafeTransfer.sol';
import '../libraries/SafeCast.sol';
import './AlgebraPoolBase.sol';

/// @title Algebra reserves management abstract contract
/// @notice Encapsulates logic for tracking and changing pool reserves
abstract contract ReservesManager is AlgebraPoolBase {
  using SafeCast for uint256;

  /// @dev The tracked token0 and token1 reserves of pool
  uint128 private reserve0;
  uint128 private reserve1;

  /// @inheritdoc IAlgebraPoolState
  function getReserves() external view returns (uint128, uint128) {
    return (reserve0, reserve1);
  }

  function _updateReserves() internal returns (uint256 balance0, uint256 balance1) {
    (balance0, balance1) = (_balanceToken0(), _balanceToken1());
    unchecked {
      if (balance0 > type(uint128).max) {
        SafeTransfer.safeTransfer(token0, communityVault, balance0 - type(uint128).max);
        balance0 = type(uint128).max;
      }
      if (balance1 > type(uint128).max) {
        SafeTransfer.safeTransfer(token1, communityVault, balance1 - type(uint128).max);
        balance1 = type(uint128).max;
      }
    }

    uint128 _liquidity = liquidity;
    if (_liquidity == 0) return (balance0, balance1);

    (uint128 _reserve0, uint128 _reserve1) = (reserve0, reserve1);
    bool isBalance0MoreReserve0 = balance0 > _reserve0;
    bool isBalance1MoreReserve1 = balance1 > _reserve1;
    if (isBalance0MoreReserve0 || isBalance1MoreReserve1) {
      unchecked {
        if (isBalance0MoreReserve0) {
          totalFeeGrowth0Token += FullMath.mulDiv(balance0 - _reserve0, Constants.Q128, _liquidity);
        }
        if (isBalance1MoreReserve1) {
          totalFeeGrowth1Token += FullMath.mulDiv(balance1 - _reserve1, Constants.Q128, _liquidity);
        }
        (reserve0, reserve1) = (uint128(balance0), uint128(balance1));
      }
    }
  }

  /**
   * @notice Applies deltas to reserves and pays communityFees
   * @param deltaR0 Amount of token0 to add/subtract to/from reserve0, must not exceed uint128
   * @param deltaR1 Amount of token1 to add/subtract to/from reserve1, must not exceed uint128
   * @param communityFee0 Amount of token0 to pay as communityFee, must not exceed uint128
   * @param communityFee1 Amount of token1 to pay as communityFee, must not exceed uint128
   */
  function _changeReserves(int256 deltaR0, int256 deltaR1, uint256 communityFee0, uint256 communityFee1) internal {
    if (communityFee0 | communityFee1 != 0) {
      unchecked {
        // overflow is desired since we do not support tokens with totalSupply > type(uint128).max
        uint256 _cfPending0 = uint256(communityFeePending0) + communityFee0;
        uint256 _cfPending1 = uint256(communityFeePending1) + communityFee1;
        uint32 currentTimestamp = _blockTimestamp();
        // underflow in timestamps is desired
        if (
          currentTimestamp - communityFeeLastTimestamp >= Constants.COMMUNITY_FEE_TRANSFER_FREQUENCY ||
          _cfPending0 > type(uint128).max ||
          _cfPending1 > type(uint128).max
        ) {
          if (_cfPending0 > 0) SafeTransfer.safeTransfer(token0, communityVault, _cfPending0);
          if (_cfPending1 > 0) SafeTransfer.safeTransfer(token1, communityVault, _cfPending1);
          communityFeeLastTimestamp = currentTimestamp;
          (deltaR0, deltaR1) = (deltaR0 - _cfPending0.toInt256(), deltaR1 - _cfPending1.toInt256());
          (_cfPending0, _cfPending1) = (0, 0);
        }
        // the previous block guarantees that no overflow occurs
        (communityFeePending0, communityFeePending1) = (uint128(_cfPending0), uint128(_cfPending1));
      }
    }

    if (deltaR0 | deltaR1 == 0) return;
    (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);
    if (deltaR0 != 0) _reserve0 = (uint256(int256(_reserve0) + deltaR0)).toUint128();
    if (deltaR1 != 0) _reserve1 = (uint256(int256(_reserve1) + deltaR1)).toUint128();
    (reserve0, reserve1) = (uint128(_reserve0), uint128(_reserve1));
  }
}
