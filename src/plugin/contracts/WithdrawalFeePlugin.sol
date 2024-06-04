// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';

import '@cryptoalgebra/integral-periphery/contracts/libraries/CallbackValidation.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/LiquidityAmounts.sol';

import './libraries/integration/OracleLibrary.sol';

import './interfaces/IBasePluginV1Factory.sol';
import './interfaces/IWithdrawalFeePlugin.sol';

contract WithdrawalFeePlugin is IWithdrawalFeePlugin, Timestamp {
  address public immutable poolDeployer;
  address public immutable factory;
  address public immutable vault;

  bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');
  uint64 public constant FEE_DENOMINATOR = 1e3;
  uint32 public constant YEAR = 31536000;

  mapping(address => Aprs) public override aprs;
  mapping(address => mapping(bytes32 => Position)) public override positions;

  constructor(address _deployer, address _factory, address _vault) {
    poolDeployer = _deployer;
    factory = _factory;
    vault = _vault;
  }

  uint32 public override withdrawalFee;

  struct MintCallbackData {
    PoolAddress.PoolKey poolKey;
    address caller;
    bytes data;
  }

  function setTokenAPR(address pool, uint128 _apr0, uint128 _apr1) external override {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    aprs[pool] = Aprs({apr0: _apr0, apr1: _apr1});
  }

  function setWithdrawalFee(uint16 newWithdrawalFee) external override {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    require(newWithdrawalFee < FEE_DENOMINATOR);
    withdrawalFee = newWithdrawalFee;
  }

  function algebraMintCallback(uint256 amount0, uint256 amount1, bytes calldata data) external override {
    MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
    CallbackValidation.verifyCallback(poolDeployer, decoded.poolKey);

    IAlgebraMintCallback(decoded.caller).algebraMintCallback(amount0, amount1, decoded.data);
  }

  function mint(
    PoolAddress.PoolKey memory poolKey,
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity,
    bytes memory _data
  ) external override returns (uint256 amount0, uint256 amount1, uint128 liquidityActual) {
    if (liquidity == 0) revert ZeroLiquidity();

    IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));

    {
      MintCallbackData memory data = MintCallbackData({poolKey: poolKey, caller: msg.sender, data: _data});

      (amount0, amount1, liquidityActual) = pool.mint(recipient, address(this), tickLower, tickUpper, liquidity, abi.encode(data));
    }

    Position storage position = _getOrCreatePosition(address(pool), msg.sender, tickLower, tickUpper);
    uint128 positionLiquidity = position.liquidity;

    {
      (uint128 fees0, uint128 fees1) = _updateUncollectedFees(position, pool, address(this), tickLower, tickUpper, positionLiquidity);

      position.token0Owed += fees0;
      position.token1Owed += fees1;
    }

    if (positionLiquidity != 0) {
      (uint128 withdrawalFees0, uint128 withdrawalFees1) = _calculateWithdrawalFee(
        pool,
        tickLower,
        tickUpper,
        positionLiquidity,
        position.lastUpdateTimestamp
      );
      position.withdrawalFees0 += withdrawalFees0;
      position.withdrawalFees1 += withdrawalFees1;
    }

    position.liquidity = positionLiquidity + liquidityActual;
    position.lastUpdateTimestamp = _blockTimestamp();
  }

  function burn(
    PoolAddress.PoolKey memory poolKey,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity
  ) external override returns (uint256 amount0, uint256 amount1) {
    IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));

    Position storage position = _getOrCreatePosition(address(pool), msg.sender, tickLower, tickUpper);

    uint128 positionLiquidity = position.liquidity;

    if (positionLiquidity != 0) {
      (uint128 withdrawalFees0, uint128 withdrawalFees1) = _calculateWithdrawalFee(
        pool,
        tickLower,
        tickUpper,
        positionLiquidity,
        position.lastUpdateTimestamp
      );
      position.withdrawalFees0 += withdrawalFees0;
      position.withdrawalFees1 += withdrawalFees1;
    }

    (amount0, amount1) = pool.burn(tickLower, tickUpper, liquidity, '');
    uint128 collectedFees0;
    uint128 collectedFees1;

    {
      (uint128 fees0, uint128 fees1) = _updateUncollectedFees(position, pool, address(this), tickLower, tickUpper, positionLiquidity);

      uint128 positionToken0Owed = uint128(position.token0Owed + fees0 + amount0);
      uint128 positionToken1Owed = uint128(position.token1Owed + fees1 + amount1);

      collectedFees0 = position.withdrawalFees0 > positionToken0Owed ? positionToken0Owed : position.withdrawalFees0;
      collectedFees1 = position.withdrawalFees1 > positionToken1Owed ? positionToken1Owed : position.withdrawalFees1;
    }

    position.withdrawalFees0 -= collectedFees0;
    position.withdrawalFees1 -= collectedFees1;
    position.token0Owed -= collectedFees0;
    position.token1Owed -= collectedFees1;

    // send withdrawal fees to the vault
    pool.collect(vault, tickLower, tickUpper, collectedFees0, collectedFees1);

    require(liquidity >= positionLiquidity);
    position.liquidity = positionLiquidity - liquidity;
    position.lastUpdateTimestamp = _blockTimestamp();
  }

  function collect(
    PoolAddress.PoolKey memory poolKey,
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount0,
    uint128 amount1
  ) external override returns (uint128 collected0, uint128 collected1) {
    IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));

    Position storage position = _getOrCreatePosition(address(pool), msg.sender, tickLower, tickUpper);

    (collected0, collected1) = pool.collect(
      recipient,
      tickLower,
      tickUpper,
      amount0 > position.token0Owed ? position.token0Owed : amount0,
      amount1 > position.token1Owed ? position.token1Owed : amount1
    );

    position.token0Owed -= collected0;
    position.token1Owed -= collected1;
  }

  function _calculateWithdrawalFee(
    IAlgebraPool pool,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity,
    uint32 lastUpdateTimestamp
  ) internal view returns (uint128 amount0, uint128 amount1) {
    uint32 period = _blockTimestamp() - lastUpdateTimestamp;

    address oracle = IAlgebraPool(pool).plugin();
    int24 timeWeightedAverageTick = OracleLibrary.consult(oracle, period);

    (uint256 liquidityAmount0, uint256 liquidityAmount1) = LiquidityAmounts.getAmountsForLiquidity(
      TickMath.getSqrtRatioAtTick(timeWeightedAverageTick),
      TickMath.getSqrtRatioAtTick(tickLower),
      TickMath.getSqrtRatioAtTick(tickUpper),
      liquidity
    );

    uint256 token0apr = aprs[address(pool)].apr0;
    uint256 token1par = aprs[address(pool)].apr1;

    uint256 amount0EarnedFromStake = (token0apr * period * liquidityAmount0) / (FEE_DENOMINATOR * YEAR);
    uint256 amount1EarnedFromStake = (token1par * period * liquidityAmount1) / (FEE_DENOMINATOR * YEAR);

    (amount0, amount1) = (
      uint128((amount0EarnedFromStake * withdrawalFee) / FEE_DENOMINATOR),
      uint128((amount1EarnedFromStake * withdrawalFee) / FEE_DENOMINATOR)
    );
  }

  /// @notice This function fetches certain position object
  /// @param owner The address owing the position
  /// @param bottomTick The position's bottom tick
  /// @param topTick The position's top tick
  /// @return position The Position object
  function _getOrCreatePosition(address pool, address owner, int24 bottomTick, int24 topTick) internal view returns (Position storage) {
    bytes32 key = _getPositionKey(owner, bottomTick, topTick);
    return positions[pool][key];
  }

  function _getPositionKey(address owner, int24 bottomTick, int24 topTick) internal pure returns (bytes32 key) {
    assembly {
      key := or(shl(24, or(shl(24, owner), and(bottomTick, 0xFFFFFF))), and(topTick, 0xFFFFFF))
    }
  }

  function _updateUncollectedFees(
    Position storage position,
    IAlgebraPool pool,
    address owner,
    int24 tickLower,
    int24 tickUpper,
    uint128 positionLiquidity
  ) private returns (uint128 tokensOwed0, uint128 tokensOwed1) {
    (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool.positions(_getPositionKey(owner, tickLower, tickUpper));
    unchecked {
      tokensOwed0 = uint128(FullMath.mulDiv(feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128, positionLiquidity, Constants.Q128));
      tokensOwed1 = uint128(FullMath.mulDiv(feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128, positionLiquidity, Constants.Q128));
    }

    position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
    position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;
  }
}
