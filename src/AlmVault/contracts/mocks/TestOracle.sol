// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.8.4;

import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {UV3Math} from './../lib/UV3Math.sol';
import {ITestOracle} from './ITestOracle.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {IAlgebraVaultFactory} from '../interfaces/IAlgebraVaultFactory.sol';

/**
 @notice test UNI v3 oracle.
 */
contract TestOracle is ITestOracle {
  using SafeMath for uint256;

  uint256 public constant PRECISION = 1e36;

  uint32 public constant TWAP_PERIOD = 60 minutes;

  /**
     @notice returns equivalent _tokenOut for _amountIn, _tokenIn using spot price
     @param _pool Uniswap V3 pool address to be used for price checking
     @param _token0 token the input amount is in
     @param _token1 token for the output amount
     @param price price of 1e36 of token0 in token1
     */
  function spotPrice(address _pool, address _token0, address _token1) external view override returns (uint256 price) {
    price = _fetchSpot(_token0, _token1, currentTick(_pool), PRECISION);
  }

  /**
     @notice returns equivalent _tokenOut for _amountIn, _tokenIn using TWAP price
     @param _pool Uniswap V3 pool address to be used for price checking
     @param _token0 token the input amount is in
     @param _token1 token for the output amount
     @param price price of 1e36 of token0 in token1
     */
  function twapPrice(address _pool, address _token0, address _token1) external view override returns (uint256 price) {
    price = _fetchTwap(_pool, _token0, _token1, TWAP_PERIOD, PRECISION);
  }

  /**
     @notice Returns current price tick
     @param _pool Algebra V1 pool address to be used for price checking
     */
  function currentTick(address _pool) public view returns (int24 tick) {
    (, int24 tick_, , , , ) = IAlgebraPool(_pool).globalState();
    tick = tick_;
  }

  /**
     @notice returns equivalent _tokenOut for _amountIn, _tokenIn using spot price
     @param _tokenIn token the input amount is in
     @param _tokenOut token for the output amount
     @param _tick tick for the spot price
     @param _amountIn amount in _tokenIn
     @param amountOut equivalent anount in _tokenOut
     */
  function _fetchSpot(address _tokenIn, address _tokenOut, int24 _tick, uint256 _amountIn) internal pure returns (uint256 amountOut) {
    return UV3Math.getQuoteAtTick(_tick, UV3Math.toUint128(_amountIn), _tokenIn, _tokenOut);
  }

  /**
     @notice returns equivalent _tokenOut for _amountIn, _tokenIn using TWAP price
     @param _pool Uniswap V3 pool address to be used for price checking
     @param _tokenIn token the input amount is in
     @param _tokenOut token for the output amount
     @param _twapPeriod the averaging time period
     @param _amountIn amount in _tokenIn
     @param amountOut equivalent anount in _tokenOut
     */
  function _fetchTwap(
    address _pool,
    address _tokenIn,
    address _tokenOut,
    uint32 _twapPeriod,
    uint256 _amountIn
  ) internal view returns (uint256 amountOut) {
    address basePlugin = IAlgebraPool(_pool).plugin();
    // make sure the base plugin is connected to the pool
    require(UV3Math.isOracleConnectedToPool(basePlugin, _pool), 'AV: diconnected plugin');

    int256 twapTick = UV3Math.consult(basePlugin, _twapPeriod);
    return
      UV3Math.getQuoteAtTick(
        int24(twapTick), // can assume safe being result from consult()
        UV3Math.toUint128(_amountIn),
        _tokenIn,
        _tokenOut
      );
  }
}
