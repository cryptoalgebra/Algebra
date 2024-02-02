// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../libraries/SafeCast.sol';
import './AlgebraPoolBase.sol';

/// @title Algebra reserves management abstract contract
/// @notice Encapsulates logic for tracking and changing pool reserves
/// @dev The reserve mechanism allows the pool to keep track of unexpected increases in balances
abstract contract ReservesManager is AlgebraPoolBase {
  using SafeCast for uint256;

  /// @dev The tracked token0 and token1 reserves of pool
  uint128 internal reserve0;
  uint128 internal reserve1;

  /// @inheritdoc IAlgebraPoolState
  function getReserves() external view returns (uint128, uint128) {
    return (reserve0, reserve1);
  }

  /// @dev updates reserves data and distributes excess in the form of fee to liquidity providers.
  /// If any of the balances is greater than uint128, the excess is sent to the communityVault
  function _updateReserves() internal returns (uint256 balance0, uint256 balance1) {
    (balance0, balance1) = (_balanceToken0(), _balanceToken1());
    // we do not support tokens with totalSupply > type(uint128).max, so any excess will be sent to communityVault
    // this situation can only occur if the tokens are sent directly to the pool from outside
    // **such excessive tokens will be burned if there is no communityVault connected**
    if (balance0 > type(uint128).max || balance1 > type(uint128).max) {
      unchecked {
        address _communityVault = communityVault;
        if (balance0 > type(uint128).max) {
          _transfer(token0, _communityVault, balance0 - type(uint128).max);
          balance0 = type(uint128).max;
        }
        if (balance1 > type(uint128).max) {
          _transfer(token1, _communityVault, balance1 - type(uint128).max);
          balance1 = type(uint128).max;
        }
      }
    }

    uint128 _liquidity = liquidity;
    if (_liquidity == 0) return (balance0, balance1);

    (uint128 _reserve0, uint128 _reserve1) = (reserve0, reserve1);
    (bool hasExcessToken0, bool hasExcessToken1) = (balance0 > _reserve0, balance1 > _reserve1);
    if (hasExcessToken0 || hasExcessToken1) {
      unchecked {
        if (hasExcessToken0) totalFeeGrowth0Token += FullMath.mulDiv(balance0 - _reserve0, Constants.Q128, _liquidity);
        if (hasExcessToken1) totalFeeGrowth1Token += FullMath.mulDiv(balance1 - _reserve1, Constants.Q128, _liquidity);
        (reserve0, reserve1) = (uint128(balance0), uint128(balance1));
      }
    }
  }

  /// @notice Applies deltas to reserves and pays communityFees
  /// @dev Community fee is sent to the vault at a specified frequency or when variables communityFeePending{0,1} overflow
  /// @param deltaR0 Amount of token0 to add/subtract to/from reserve0, must not exceed uint128
  /// @param deltaR1 Amount of token1 to add/subtract to/from reserve1, must not exceed uint128
  /// @param communityFee0 Amount of token0 to pay as communityFee, must not exceed uint128
  /// @param communityFee1 Amount of token1 to pay as communityFee, must not exceed uint128
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
          _cfPending0 > type(uint104).max ||
          _cfPending1 > type(uint104).max
        ) {
          address _communityVault = communityVault;
          if (_cfPending0 > 0) _transfer(token0, _communityVault, _cfPending0);
          if (_cfPending1 > 0) _transfer(token1, _communityVault, _cfPending1);
          communityFeeLastTimestamp = currentTimestamp;
          (deltaR0, deltaR1) = (deltaR0 - _cfPending0.toInt256(), deltaR1 - _cfPending1.toInt256());
          (_cfPending0, _cfPending1) = (0, 0);
        }
        // the previous block guarantees that no overflow occurs
        (communityFeePending0, communityFeePending1) = (uint104(_cfPending0), uint104(_cfPending1));
      }
    }

    if (deltaR0 | deltaR1 == 0) return;
    (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);
    if (deltaR0 != 0) _reserve0 = (uint256(int256(_reserve0) + deltaR0)).toUint128();
    if (deltaR1 != 0) _reserve1 = (uint256(int256(_reserve1) + deltaR1)).toUint128();
    (reserve0, reserve1) = (uint128(_reserve0), uint128(_reserve1));
  }
}
