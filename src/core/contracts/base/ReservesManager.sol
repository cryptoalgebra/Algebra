// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../libraries/SafeCast.sol';
import './AlgebraPoolBase.sol';
import '../interfaces/plugin/IAlgebraPlugin.sol';
import '../interfaces/pool/IAlgebraPoolErrors.sol';
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
        emit ExcessTokens(balance0 - _reserve0, balance1 - _reserve1);
        (reserve0, reserve1) = (uint128(balance0), uint128(balance1));
      }
    }
  }

  /// @notice Forces reserves to match balances. Excess of tokens will be sent to `receiver`
  function _skimReserves(address receiver) internal {
    (uint256 balance0, uint256 balance1) = (_balanceToken0(), _balanceToken1());
    (uint128 _reserve0, uint128 _reserve1) = (reserve0, reserve1);
    if (balance0 > _reserve0 || balance1 > _reserve1) {
      if (balance0 > _reserve0) _transfer(token0, receiver, balance0 - _reserve0);
      if (balance1 > _reserve1) _transfer(token1, receiver, balance1 - _reserve1);
      emit Skim(receiver, balance0 - _reserve0, balance1 - _reserve1);
    }
  }

  function _accrueAndTransferFees(
    uint256 fee0,
    uint256 fee1,
    uint256 lastTimestamp,
    address recipient,
    bytes32 slot
  ) internal returns (uint256, uint256, uint256, uint256) {
    uint256 feePending0;
    uint256 feePending1;

    assembly {
      // Load the storage slot specified by the slot argument
      let sl := sload(slot)

      // Extract the uint104 value
      feePending0 := and(sl, 0xFFFFFFFFFFFFFFFFFFFFFFFFFF)

      // Shift right by 104 bits and extract the uint104 value
      feePending1 := and(shr(104, sl), 0xFFFFFFFFFFFFFFFFFFFFFFFFFF)
    }

    feePending0 += fee0;
    feePending1 += fee1;

    if (_blockTimestamp() - lastTimestamp >= Constants.FEE_TRANSFER_FREQUENCY || feePending0 > type(uint104).max || feePending1 > type(uint104).max) {
      (uint256 feeSent0, uint256 feeSent1) = _transferFees(feePending0, feePending1, recipient);
      assembly {
        sstore(slot, 0)
      }
      return (0, 0, feeSent0, feeSent1);
    } else {
      return (feePending0, feePending1, 0, 0);
    }
  }

  function _transferFees(
    uint256 feePending0,
    uint256 feePending1,
    address feesRecipient
  ) private returns (uint256, uint256) {
    uint256 feeSent0;
    uint256 feeSent1;

    if (feePending0 > 0) {
      _transfer(token0, feesRecipient, feePending0);
      feeSent0 = feePending0;
    }
    if (feePending1 > 0) {
      _transfer(token1, feesRecipient, feePending1);
      feeSent1 = feePending1;
    }

    return (feeSent0, feeSent1);
  }

  /// @notice Applies deltas to reserves and pays communityFees
  /// @dev Community fee is sent to the vault at a specified frequency or when variables communityFeePending{0,1} overflow
  /// @param deltaR0 Amount of token0 to add/subtract to/from reserve0, must not exceed uint128
  /// @param deltaR1 Amount of token1 to add/subtract to/from reserve1, must not exceed uint128
  /// @param communityFee0 Amount of token0 to pay as communityFee, must not exceed uint128
  /// @param communityFee1 Amount of token1 to pay as communityFee, must not exceed uint128
  function _changeReserves(
    int256 deltaR0,
    int256 deltaR1,
    uint256 communityFee0,
    uint256 communityFee1,
    uint256 pluginFee0,
    uint256 pluginFee1
  ) internal {
    if (communityFee0 > 0 || communityFee1 > 0 || pluginFee0 > 0 || pluginFee1 > 0) {
      bytes32 slot;
      uint32 lastTimestamp = lastFeeTransferTimestamp;
      uint32 currentTimestamp = _blockTimestamp();
      bool feeSent;
      if (communityFee0 | communityFee1 != 0) {
        assembly {
          slot := communityFeePending0.slot
        }

        (uint256 feePending0, uint256 feePending1, uint256 feeSent0, uint256 feeSent1) = _accrueAndTransferFees(communityFee0, communityFee1, lastTimestamp, communityVault, slot);
        if (feeSent0 | feeSent1 != 0) {
          (deltaR0, deltaR1) = (deltaR0 - feeSent0.toInt256(), deltaR1 - feeSent1.toInt256());
          feeSent = true;
        } else {
          (communityFeePending0, communityFeePending1) = (uint104(feePending0), uint104(feePending1));
        }
      }

      if (pluginFee0 | pluginFee1 != 0) {
        assembly {
          slot := pluginFeePending0.slot
        }

        (uint256 feePending0, uint256 feePending1, uint256 feeSent0, uint256 feeSent1) = _accrueAndTransferFees(pluginFee0, pluginFee1, lastTimestamp, plugin, slot);
        if (feeSent0 | feeSent1 != 0) {
          (deltaR0, deltaR1) = (deltaR0 - feeSent0.toInt256(), deltaR1 - feeSent1.toInt256());
          feeSent = true;

          if (IAlgebraPlugin(plugin).handlePluginFee(feeSent0, feeSent1) != IAlgebraPlugin.handlePluginFee.selector) revert IAlgebraPoolErrors.invalidPluginResponce();
        } else {
          (pluginFeePending0, pluginFeePending1) = (uint104(feePending0), uint104(feePending1));
        }
      } else if (feeSent) {
        (uint256 feeSent0, uint256 feeSent1) = _transferFees(pluginFeePending0, pluginFeePending1, plugin);
        if (feeSent0 | feeSent1 != 0) {
          (pluginFeePending0, pluginFeePending1) = (0, 0);
          (deltaR0, deltaR1) = (deltaR0 - feeSent0.toInt256(), deltaR1 - feeSent1.toInt256());

          if (IAlgebraPlugin(plugin).handlePluginFee(feeSent0, feeSent1) != IAlgebraPlugin.handlePluginFee.selector) revert IAlgebraPoolErrors.invalidPluginResponce();
        }
      }

      if (feeSent) lastFeeTransferTimestamp = currentTimestamp;
    }

    if (deltaR0 | deltaR1 == 0) return;
    (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);
    if (deltaR0 != 0) _reserve0 = (uint256(int256(_reserve0) + deltaR0)).toUint128();
    if (deltaR1 != 0) _reserve1 = (uint256(int256(_reserve1) + deltaR1)).toUint128();
    (reserve0, reserve1) = (uint128(_reserve0), uint128(_reserve1));
  }
}
