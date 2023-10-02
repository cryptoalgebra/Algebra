// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';

import '@cryptoalgebra/integral-periphery/contracts/libraries/CallbackValidation.sol';

import './interfaces/IBasePluginV1Factory.sol';
import './interfaces/plugins/ILimitOrderPlugin.sol';

import './base/LimitOrderPayments.sol';

contract LimitOrderPlugin is ILimitOrderPlugin, LimitOrderPayments {
  constructor(address _wNativeToken, address _poolDeployer, address _basePluginFactory, address _factory) LimitOrderPayments(_wNativeToken) {
    poolDeployer = _poolDeployer;
    basePluginFactory = _basePluginFactory;
    factory = _factory;
  }

  using EpochLibrary for Epoch;

  address public immutable poolDeployer;
  address public immutable factory;
  address public immutable basePluginFactory;

  bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');
  bytes internal constant ZERO_BYTES = bytes('');

  Epoch internal constant EPOCH_DEFAULT = Epoch.wrap(0);

  mapping(address => int24) public tickLowerLasts;
  mapping(address => int24) public tickSpacings;

  Epoch public epochNext = Epoch.wrap(1);

  struct EpochInfo {
    bool filled;
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidityTotal;
    address token0;
    address token1;
    uint128 token0Total;
    uint128 token1Total;
    mapping(address => uint128) liquidity;
  }

  struct MintCallbackData {
    PoolAddress.PoolKey poolKey;
    address payer;
  }

  mapping(bytes32 => Epoch) public epochs;
  mapping(Epoch => EpochInfo) public epochInfos;

  modifier onlyPlugin(address pool) {
    address plugin = IBasePluginV1Factory(basePluginFactory).pluginByPool(pool);
    if (msg.sender != plugin) revert NotPlugin();
    _;
  }

  function getEpoch(address pool, int24 tickLower, int24 tickUpper, bool zeroForOne) public view returns (Epoch) {
    return epochs[keccak256(abi.encode(pool, tickLower, tickUpper, zeroForOne))];
  }

  function setEpoch(address pool, int24 tickLower, int24 tickUpper, bool zeroForOne, Epoch epoch) private {
    epochs[keccak256(abi.encode(pool, tickLower, tickUpper, zeroForOne))] = epoch;
  }

  function getEpochLiquidity(Epoch epoch, address owner) external view returns (uint256) {
    return epochInfos[epoch].liquidity[owner];
  }

  function setTickSpacing(address pool, int24 tickSpacing) external override {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    tickSpacings[pool] = tickSpacing;
  }

  function getTickSpacing(address pool) private view returns (int24 tickSpacing) {
    tickSpacing = tickSpacings[pool];
    if (tickSpacing == 0) {
      return IAlgebraPool(pool).tickSpacing();
    } else return tickSpacing;
  }

  function getTick(address pool) private view returns (int24 tick) {
    (, tick, , , , ) = IAlgebraPool(pool).globalState();
  }

  function getTickLower(int24 tick, int24 tickSpacing) private pure returns (int24) {
    int24 compressed = tick / tickSpacing;
    if (tick < 0 && tick % tickSpacing != 0) compressed--; // round towards negative infinity
    return compressed * tickSpacing;
  }

  function _getCrossedTicks(address pool, int24 tick, int24 tickSpacing) internal view returns (int24 tickLower, int24 lower, int24 upper) {
    tickLower = getTickLower(tick, tickSpacing);
    int24 tickLowerLast = tickLowerLasts[pool];

    if (tickLower < tickLowerLast) {
      lower = tickLower + tickSpacing;
      upper = tickLowerLast;
    } else {
      lower = tickLowerLast;
      upper = tickLower - tickSpacing;
    }
  }

  function _fillEpoch(address pool, int24 lower, int24 upper, bool zeroForOne) internal {
    Epoch epoch = getEpoch(pool, lower, upper, zeroForOne);

    if (!epoch.equals(EPOCH_DEFAULT)) {
      EpochInfo storage epochInfo = epochInfos[epoch];

      epochInfo.filled = true;

      (uint256 amount0, uint256 amount1) = IAlgebraPool(pool).burn(lower, upper, epochInfo.liquidityTotal, '');

      unchecked {
        epochInfo.token0Total += uint128(amount0) - 1;
        epochInfo.token1Total += uint128(amount1);
      }

      setEpoch(pool, lower, upper, zeroForOne, EPOCH_DEFAULT);

      emit Fill(epoch, lower, zeroForOne);
    }
  }

  function algebraMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external override {
    MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
    CallbackValidation.verifyCallback(poolDeployer, decoded.poolKey);

    if (amount0Owed > 0) _pay(decoded.poolKey.token0, decoded.payer, msg.sender, amount0Owed);
    if (amount1Owed > 0) _pay(decoded.poolKey.token1, decoded.payer, msg.sender, amount1Owed);
  }

  function place(PoolAddress.PoolKey memory poolKey, int24 tickLower, bool zeroForOne, uint128 liquidity) external override {
    if (liquidity == 0) revert ZeroLiquidity();

    address pool = PoolAddress.computeAddress(poolDeployer, poolKey);

    bytes memory data = abi.encode(MintCallbackData({poolKey: poolKey, payer: msg.sender}));
    int24 tickUpper = tickLower + getTickSpacing(pool);

    // TODO  set last tick if skip initialize?
    (uint256 amount0, uint256 amount1, uint128 liquidityActual) = IAlgebraPool(pool).mint(
      msg.sender,
      address(this),
      tickLower,
      tickUpper,
      liquidity,
      data
    );

    if (amount0 > 0) {
      if (amount1 != 0) revert InRange();
      if (!zeroForOne) revert CrossedRange();
    } else {
      if (amount0 != 0) revert InRange();
      if (zeroForOne) revert CrossedRange();
    }

    EpochInfo storage epochInfo;
    Epoch epoch = getEpoch(pool, tickLower, tickUpper, zeroForOne);
    if (epoch.equals(EPOCH_DEFAULT)) {
      unchecked {
        setEpoch(pool, tickLower, tickUpper, zeroForOne, epoch = epochNext);
        // since epoch was just assigned the current value of epochNext,
        // this is equivalent to epochNext++, which is what's intended,
        // and it saves an SLOAD
        epochNext = epoch.unsafeIncrement();
      }
      epochInfo = epochInfos[epoch];
      epochInfo.token0 = poolKey.token0;
      epochInfo.token1 = poolKey.token1;
    } else {
      epochInfo = epochInfos[epoch];
    }

    unchecked {
      epochInfo.liquidityTotal += liquidityActual;
      epochInfo.liquidity[msg.sender] += liquidityActual;
    }

    epochInfo.tickLower = tickLower;
    epochInfo.tickUpper = tickUpper;

    if (epochInfo.token0Total == 0 && epochInfo.token1Total == 0) {
      epochInfo.token0Total = 1;
    }

    emit Place(msg.sender, epoch, tickLower, zeroForOne, liquidityActual);
  }

  function kill(
    PoolAddress.PoolKey memory poolKey,
    int24 tickLower,
    int24 tickUpper,
    bool zeroForOne,
    address to
  ) external override returns (uint256 amount0, uint256 amount1) {
    address pool = PoolAddress.computeAddress(poolDeployer, poolKey);

    Epoch epoch = getEpoch(pool, tickLower, tickUpper, zeroForOne);
    EpochInfo storage epochInfo = epochInfos[epoch];

    if (epochInfo.filled) revert Filled();

    uint128 liquidity = epochInfo.liquidity[msg.sender];
    if (liquidity == 0) revert ZeroLiquidity();
    delete epochInfo.liquidity[msg.sender];
    uint128 liquidityTotal = epochInfo.liquidityTotal;
    epochInfo.liquidityTotal = liquidityTotal - liquidity;

    // when the all liquidity of the position is taken, fees is sent to the pool
    (uint256 amount0Fee, uint256 amount1Fee) = IAlgebraPool(pool).burn(tickLower, tickUpper, 0, '');
    if (liquidityTotal - liquidity == 0) {
      IAlgebraPool(pool).collect(
        pool,
        tickLower,
        tickUpper,
        uint128(amount0Fee) + epochInfo.token0Total - 1,
        uint128(amount1Fee) + epochInfo.token1Total
      );
      epochInfo.token0Total = 0;
      epochInfo.token1Total = 0;
    } else {
      epochInfo.token0Total += uint128(amount0Fee);
      epochInfo.token1Total += uint128(amount1Fee);
    }

    (amount0, amount1) = IAlgebraPool(pool).burn(tickLower, tickUpper, liquidity, '');
    IAlgebraPool(pool).collect(address(this), tickLower, tickUpper, uint128(amount0), uint128(amount1));

    claimTo(poolKey, to);

    emit Kill(msg.sender, epoch, tickLower, zeroForOne, liquidity);
  }

  function withdraw(Epoch epoch, address to) external returns (uint256 amount0, uint256 amount1) {
    EpochInfo storage epochInfo = epochInfos[epoch];

    PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey({token0: epochInfo.token0, token1: epochInfo.token1});
    address pool = PoolAddress.computeAddress(poolDeployer, poolKey);

    if (!epochInfo.filled) revert NotFilled();

    uint128 liquidity = epochInfo.liquidity[msg.sender];
    if (liquidity == 0) revert ZeroLiquidity();
    delete epochInfo.liquidity[msg.sender];

    uint256 token0Total = epochInfo.token0Total;
    uint256 token1Total = epochInfo.token1Total;
    uint128 liquidityTotal = epochInfo.liquidityTotal;

    amount0 = FullMath.mulDiv(token0Total, liquidity, liquidityTotal);
    amount1 = FullMath.mulDiv(token1Total, liquidity, liquidityTotal);

    epochInfo.token0Total = uint128(token0Total - amount0);
    epochInfo.token1Total = uint128(token1Total - amount1);
    epochInfo.liquidityTotal = liquidityTotal - liquidity;

    IAlgebraPool(pool).collect(address(this), epochInfo.tickLower, epochInfo.tickUpper, uint128(amount0), uint128(amount1));

    claimTo(poolKey, to);

    emit Withdraw(msg.sender, epoch, liquidity);
  }

  function afterInitialize(address pool, int24 tick) external override onlyPlugin(pool) {
    tickLowerLasts[pool] = getTickLower(tick, getTickSpacing(pool));
  }

  function afterSwap(address pool, bool zeroToOne, int24 tick) external override onlyPlugin(pool) {
    int24 tickSpacing = getTickSpacing(pool);
    (int24 tickLower, int24 lower, int24 upper) = _getCrossedTicks(pool, tick, tickSpacing);

    if (lower > upper) return;

    // note that a zeroToOne swap means that the pool is actually gaining token0, so limit
    // order fills are the opposite of swap fills, hence the inversion below
    for (; lower <= upper; lower += tickSpacing) {
      _fillEpoch(pool, lower, lower + tickSpacing, !zeroToOne);
    }

    tickLowerLasts[pool] = getTickLower(tickLower, tickSpacing);
  }
}
