// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4;

import {TickMath} from '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import {LiquidityAmounts} from '@cryptoalgebra/integral-periphery/contracts/libraries/LiquidityAmounts.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import {OracleLibrary} from './OracleLibrary.sol';
import {IAlgebraVaultFactory} from '../interfaces/IAlgebraVaultFactory.sol';

library UV3Math {
  /// @dev The minimum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MIN_TICK)
  uint160 internal constant MIN_SQRT_RATIO = 4295128739;
  /// @dev The maximum value that can be returned from #getSqrtRatioAtTick. Equivalent to getSqrtRatioAtTick(MAX_TICK)
  uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

  /*******************
   * Tick Math
   *******************/

  function getSqrtRatioAtTick(int24 currentTick) public pure returns (uint160 sqrtPriceX96) {
    sqrtPriceX96 = TickMath.getSqrtRatioAtTick(currentTick);
  }

  /*******************
   * LiquidityAmounts
   *******************/

  function getAmountsForLiquidity(
    uint160 sqrtRatioX96,
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
  ) public pure returns (uint256 amount0, uint256 amount1) {
    (amount0, amount1) = LiquidityAmounts.getAmountsForLiquidity(sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, liquidity);
  }

  function getLiquidityForAmounts(
    uint160 sqrtRatioX96,
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint256 amount0,
    uint256 amount1
  ) public pure returns (uint128 liquidity) {
    liquidity = LiquidityAmounts.getLiquidityForAmounts(sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1);
  }

  /*******************
   * OracleLibrary
   *******************/

  function consult(address _basePlugin, uint32 _twapPeriod) public view returns (int24 timeWeightedAverageTick) {
    timeWeightedAverageTick = OracleLibrary.consult(_basePlugin, _twapPeriod);
  }

  function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) public pure returns (uint256 quoteAmount) {
    quoteAmount = OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
  }

  function lastTimepointMetadata(address oracleAddress) public view returns (uint16 index, uint32 timestamp) {
    (index, timestamp) = OracleLibrary.lastTimepointMetadata(oracleAddress);
  }

  function isOracleConnectedToPool(address oracleAddress, address poolAddress) public view returns (bool connected) {
    if (oracleAddress == address(0)) return false;
    connected = OracleLibrary.isOracleConnectedToPool(oracleAddress, poolAddress);
  }

  /*******************
   * SafeUnit128
   *******************/

  /// @notice Cast a uint256 to a uint128, revert on overflow
  /// @param y The uint256 to be downcasted
  /// @return z The downcasted integer, now type uint128
  function toUint128(uint256 y) public pure returns (uint128 z) {
    require((z = uint128(y)) == y, 'SafeUint128: overflow');
  }

  /******************************
   * AlgebraVault specific functions
   ******************************/

  /**
     @dev Computes a unique vault's symbol for vaults created through Ramses factory.
     @param value index of the vault to be created
     */
  function computeAVsymbol(uint256 value, address pool, bool allowToken0) public view returns (string memory) {
    IAlgebraPool algebraPool = IAlgebraPool(pool);
    string memory token0Symbol = ERC20(algebraPool.token0()).symbol();
    string memory token1Symbol = ERC20(algebraPool.token1()).symbol();
    // Format: AV-[ammName]-index-deposit-quote
    return
      string(
        abi.encodePacked(
          'AV-',
          IAlgebraVaultFactory(msg.sender).ammName(),
          '-',
          Strings.toString(value),
          '-',
          allowToken0 ? token0Symbol : token1Symbol,
          '-',
          allowToken0 ? token1Symbol : token0Symbol
        )
      );
  }
}
