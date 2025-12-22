// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4;

import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IAccessControl} from '@openzeppelin/contracts/access/IAccessControl.sol';
import {UV3Math} from './lib/UV3Math.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

import {IAlgebraSwapCallback} from '@cryptoalgebra/integral-core/contracts/interfaces/callback/IAlgebraSwapCallback.sol';
import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {INonfungiblePositionManager} from '@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

import {IERC20Minimal} from '@cryptoalgebra/integral-core/contracts/interfaces/IERC20Minimal.sol';
import {IFarmingCenter} from '@cryptoalgebra/integral-farming/contracts/interfaces/IFarmingCenter.sol';
import {IAlgebraEternalFarming} from '@cryptoalgebra/integral-farming/contracts/interfaces/IAlgebraEternalFarming.sol';
import {IncentiveKey} from '@cryptoalgebra/integral-farming/contracts/base/IncentiveKey.sol';

import {IAlgebraVault} from './interfaces/IAlgebraVault.sol';
import {IAlgebraVaultFactory} from './interfaces/IAlgebraVaultFactory.sol';

import 'hardhat/console.sol';

/**
 @notice A Uniswap V2-like interface with fungible liquidity to Uniswap V3
 which allows for either one-sided or two-sided liquidity provision.
 AlgebraVaults should be deployed by the AlgebraVaultFactory.
 AlgebraVaults should not be used with tokens that charge transaction fees.
 */
contract AlgebraVault is IAlgebraVault, IAlgebraSwapCallback, ERC20, ReentrancyGuard {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant PRECISION = 10 ** 18;
  uint256 constant PERCENT = 100;
  address constant NULL_ADDRESS = address(0);
  uint256 constant MIN_SHARES = 1e6;

  address public immutable override algebraVaultFactory;
  address public immutable override pool;
  address public immutable override token0;
  address public immutable override token1;
  address private immutable pluginDeployer;

  bool public immutable override allowToken0;
  bool public immutable override allowToken1;

  // Set tickSpacing as immutable (though it can be changed in a pool)
  // If it suddenly changes, rebalances might not work
  // Since this is very unlikely, will redeploy the vault in that case
  int24 public immutable override tickSpacing;

  uint256 public override deposit0Max;
  uint256 public override deposit1Max;
  uint256 public override hysteresis;

  // Position tracking
  uint32 public override basePositionId;
  uint32 public override limitPositionId;

  address public override rebalanceManager;
  address public override ammFeeRecipient;
  address public override affiliate;
  address public override farmingRewardsDistributor;

  uint32 public override twapPeriod;
  uint32 public override auxTwapPeriod;

  function _checkManager() private view {
    if (!IAccessControl(algebraVaultFactory).hasRole(IAlgebraVaultFactory(algebraVaultFactory).MANAGER_ROLE(), msg.sender)) revert NotManager();
  }

  modifier onlyManager() {
    _checkManager();
    _;
  }

  modifier onlyRebalancerOrRebalanceManager() {
    if (
      !(IAccessControl(algebraVaultFactory).hasRole(IAlgebraVaultFactory(algebraVaultFactory).REBALANCER_ROLE(), msg.sender) ||
        rebalanceManager == msg.sender)
    ) revert NotRebalancer();
    _;
  }

  /**
     @notice Creates an AlgebraVault instance based on Uniswap V3 pool. Controls liquidity provision types.
     @param _pool Address of the Uniswap V3 pool for liquidity management.
     @param _allowToken0 Flag indicating if token0 deposits are allowed.
     @param _allowToken1 Flag indicating if token1 deposits are allowed.
     @param _twapPeriod TWAP period for hysteresis checks.
     @param _vaultIndex Index of the vault in the factory.
     */
  constructor(
    address _pool,
    bool _allowToken0,
    bool _allowToken1,
    uint32 _twapPeriod,
    uint256 _vaultIndex
  ) ERC20('Algebra Vault Liquidity', UV3Math.computeAVsymbol(_vaultIndex, _pool, _allowToken0)) {
    if (_pool == NULL_ADDRESS) revert ZeroAddress();
    if (_allowToken0 == _allowToken1) revert InvalidDeposit();

    algebraVaultFactory = msg.sender;
    pool = _pool;
    pluginDeployer = IAlgebraVaultFactory(algebraVaultFactory).pluginDeployer();
    token0 = IAlgebraPool(_pool).token0();
    token1 = IAlgebraPool(_pool).token1();
    tickSpacing = IAlgebraPool(_pool).tickSpacing();
    allowToken0 = _allowToken0;
    allowToken1 = _allowToken1;
    twapPeriod = _twapPeriod;
    auxTwapPeriod = _twapPeriod / 4; // default value is a quarter of the TWAP period

    hysteresis = PRECISION.div(PERCENT).div(2); // 0.5% threshold
    deposit0Max = type(uint256).max; // max uint256
    deposit1Max = type(uint256).max; // max uint256
    ammFeeRecipient = NULL_ADDRESS; // by default there is no amm fee recipient address;
    affiliate = NULL_ADDRESS; // by default there is no affiliate address

    // Approve NFT manager to spend tokens
    IERC20(token0).forceApprove(IAlgebraVaultFactory(algebraVaultFactory).nftManager(), type(uint256).max);
    IERC20(token1).forceApprove(IAlgebraVaultFactory(algebraVaultFactory).nftManager(), type(uint256).max);

    emit DeployAlgebraVault(msg.sender, _pool, _allowToken0, _allowToken1, _twapPeriod);
  }

  /// @notice gets baseLower tick from the base position
  /// @return int24 baseLower tick
  function baseLower() external view override returns (int24) {
    if (basePositionId == 0) return 0;
    (, , , , , int24 tickLower, , , , , , ) = _nftManager().positions(basePositionId);
    return tickLower;
  }

  /// @notice gets baseUpper tick from the base position
  /// @return int24 baseUpper tick
  function baseUpper() external view override returns (int24) {
    if (basePositionId == 0) return 0;
    (, , , , , , int24 tickUpper, , , , , ) = _nftManager().positions(basePositionId);
    return tickUpper;
  }

  /// @notice gets limitLower tick from the limit position
  /// @return int24 limitLower tick
  function limitLower() external view override returns (int24) {
    if (limitPositionId == 0) return 0;
    (, , , , , int24 tickLower, , , , , , ) = _nftManager().positions(limitPositionId);
    return tickLower;
  }

  /// @notice gets limitUpper tick from the limit position
  /// @return int24 limitUpper tick
  function limitUpper() external view override returns (int24) {
    if (limitPositionId == 0) return 0;
    (, , , , , , int24 tickUpper, , , , , ) = _nftManager().positions(limitPositionId);
    return tickUpper;
  }

  /// @notice sets TWAP period for hysteresis checks
  /// @dev onlyManager
  /// @param newTwapPeriod new TWAP period
  function setTwapPeriod(uint32 newTwapPeriod) external override onlyManager {
    if (newTwapPeriod == 0) revert ZeroValue();
    twapPeriod = newTwapPeriod;
    emit SetTwapPeriod(msg.sender, newTwapPeriod);
  }

  /// @notice sets auxiliary TWAP period for hysteresis checks
  /// @dev onlyManager
  /// @dev aux TWAP could be set to 0 to avoid an additional check
  /// @param newAuxTwapPeriod new auxiliary TWAP period
  function setAuxTwapPeriod(uint32 newAuxTwapPeriod) external override onlyManager {
    auxTwapPeriod = newAuxTwapPeriod;
    emit SetAuxTwapPeriod(msg.sender, newAuxTwapPeriod);
  }

  /// @notice Internal function to approve NFT for farming and enter farming position
  /// @param tokenId The ID of the NFT position to enter into farming
  function _approveAndEnterFarming(uint256 tokenId) internal {
    // Get the key from incentive maker
    IAlgebraEternalFarming farming = _eternalFarming();
    IFarmingCenter farmingCenter = _farmingCenter();
    (IERC20Minimal _rewardToken, IERC20Minimal _bonusRewardToken, IAlgebraPool _pool, uint256 _nonce) = farming.incentiveKeys(address(pool));

    // if the pool does not have farming
    if (address(_pool) == NULL_ADDRESS) return;

    IncentiveKey memory key = IncentiveKey(_rewardToken, _bonusRewardToken, _pool, _nonce);

    _nftManager().approveForFarming(tokenId, true, address(farmingCenter));

    // Enter farming
    farmingCenter.enterFarming(key, tokenId);
  }

  function _collectAndClaimRewards(uint256 tokenId) internal {
    if (tokenId == 0) return;

    // Collect rewards
    IncentiveKey memory key = _getKeyForToken(tokenId);
    // if the pool is not in the incentive maker, return
    if (address(key.pool) == NULL_ADDRESS) return;

    address recipient = farmingRewardsDistributor != NULL_ADDRESS ? farmingRewardsDistributor : affiliate;
    // not reverting, to avoid a hypothetical situation where withdraws are blocked because of missing recipient
    if (recipient == NULL_ADDRESS) return;

    (uint256 reward, uint256 bonusReward) = _farmingCenter().collectRewards(key, tokenId);

    // Claim
    if (reward > 0) {
      _farmingCenter().claimReward(key.rewardToken, recipient, reward);
    }

    if (bonusReward > 0) {
      _farmingCenter().claimReward(key.bonusRewardToken, recipient, bonusReward);
    }

    // assuming reward and bonusReward are known
    emit RewardsCollected(reward, bonusReward);
  }

  /**
     @notice Collect rewards and sends them to the farming contract.
     */
  function collectRewards() external override nonReentrant {
    (uint32 _basePositionId, uint32 _limitPositionId) = (basePositionId, limitPositionId);
    if (_basePositionId != 0) _collectAndClaimRewards(_basePositionId);
    if (_limitPositionId != 0) _collectAndClaimRewards(_limitPositionId);
  }

  function _getKeyForToken(uint256 tokenId) internal view returns (IncentiveKey memory) {
    bytes32 incentiveId = _farmingCenter().deposits(tokenId);

    (IERC20Minimal _rewardToken, IERC20Minimal _bonusRewardToken, IAlgebraPool _pool, uint256 _nonce) = _farmingCenter().incentiveKeys(incentiveId);

    return IncentiveKey({rewardToken: _rewardToken, bonusRewardToken: _bonusRewardToken, pool: _pool, nonce: _nonce});
  }

  /// @notice collects fees and tokens from the positions and burns the NFTs
  /// @param positionId NFT position ID
  function _dismantlePosition(uint256 positionId) internal returns (uint256 fee0, uint256 fee1) {
    if (positionId != 0) {
      uint128 positionLiquidity = _getPositionLiquidity(positionId);

      uint256 burntAmount0;
      uint256 burntAmount1;

      if (positionLiquidity > 0) {
        (burntAmount0, burntAmount1) = _nftManager().decreaseLiquidity(
          INonfungiblePositionManager.DecreaseLiquidityParams({
            tokenId: positionId,
            liquidity: positionLiquidity,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp
          })
        );
      }

      (uint256 collectedAmount0, uint256 collectedAmount1) = _nftManager().collect(
        INonfungiblePositionManager.CollectParams({
          tokenId: positionId,
          recipient: address(this),
          amount0Max: type(uint128).max,
          amount1Max: type(uint128).max
        })
      );
      _nftManager().burn(positionId);

      fee0 = collectedAmount0 - burntAmount0;
      fee1 = collectedAmount1 - burntAmount1;
      // not setting positionId to 0, as it is done in the rebalance->mint functions
    }
  }

  /// @notice gets NFT manager
  /// @return INonfungiblePositionManager NFT manager
  function _nftManager() internal view returns (INonfungiblePositionManager) {
    return INonfungiblePositionManager(IAlgebraVaultFactory(algebraVaultFactory).nftManager());
  }

  /// @notice gets Farming center
  /// @return IFarmingCenter Farming center
  function _farmingCenter() internal view returns (IFarmingCenter) {
    return IFarmingCenter(IAlgebraVaultFactory(algebraVaultFactory).farmingCenter());
  }

  /// @notice gets Eternal farming
  /// @return IAlgebraEternalFarming Eternal farming
  function _eternalFarming() internal view returns (IAlgebraEternalFarming) {
    return IAlgebraEternalFarming(IAlgebraVaultFactory(algebraVaultFactory).eternalFarming());
  }

  /// @notice collects fees from the position
  /// @param positionId NFT position ID
  function _collectFromPosition(uint256 positionId) internal returns (uint256 fees0, uint256 fees1) {
    if (positionId == 0) {
      return (0, 0);
    }
    (uint256 _fees0, uint256 _fees1) = _nftManager().collect(
      INonfungiblePositionManager.CollectParams({
        tokenId: positionId,
        recipient: address(this),
        amount0Max: type(uint128).max,
        amount1Max: type(uint128).max
      })
    );
    fees0 = _fees0;
    fees1 = _fees1;
  }

  /// @notice collects fees from both positions and distributes them
  /// @param withEvent flag to emit CollectFees event (false in rebalances, true otherwise)
  /// @return fees0 collected fees in token0
  /// @return fees1 collected fees in token1
  function _cleanPositions(bool withEvent) internal returns (uint256 fees0, uint256 fees1) {
    (uint128 _basePositionId, uint128 _limitPositionId) = (basePositionId, limitPositionId);

    fees0 = 0;
    fees1 = 0;
    if (_basePositionId != 0) {
      (fees0, fees1) = _collectRewardsAndAccrueFees(_basePositionId, 0, 0);
    }
    if (_limitPositionId != 0) {
      (fees0, fees1) = _collectRewardsAndAccrueFees(_limitPositionId, fees0, fees1);
    }
    if (fees0 > 0 || fees1 > 0) {
      _distributeFees(fees0, fees1);
      if (withEvent) {
        emit CollectFees(msg.sender, fees0, fees1);
      }
    }
  }

  function _collectRewardsAndAccrueFees(uint256 positionId, uint256 fees0, uint256 fees1) private returns (uint256, uint256) {
    _collectAndClaimRewards(positionId);
    (uint256 _fees0, uint256 _fees1) = _collectFromPosition(positionId);
    fees0 = fees0 + _fees0;
    fees1 = fees1 + _fees1;
    return (fees0, fees1);
  }

  /**
    @notice Internal function to mint an NFT position
    @param tickLower Lower tick of the position
    @param tickUpper Upper tick of the position
    @param amount0Desired Desired amount of token0
    @param amount1Desired Desired amount of token1
    @return positionId ID of the minted NFT position
    */
  function _mintPosition(
    int24 currentTick,
    int24 tickLower,
    int24 tickUpper,
    uint256 amount0Desired,
    uint256 amount1Desired
  ) internal returns (uint32) {
    // console.log('anus');
    // console.logInt(currentTick);
    // console.logInt(tickLower);
    // console.logInt(tickUpper);
    // console.log(amount0Desired);
    // console.log(amount1Desired);
    // console.log(1);
    // Don't try to mint if we don't have any tokens
    if (amount0Desired == 0 && amount1Desired == 0) {
      return 0;
    }
    // console.log(2);

    // If current tick is within or on the boundaries of our range, we need both tokens
    if (currentTick >= tickLower && currentTick < tickUpper) {
      // console.log(3);

      if (amount0Desired == 0 || amount1Desired == 0) {
        return 0;
      }

      // console.log(4);
    }

    // If entirely above current tick (not including boundary), we only need token0
    else if (currentTick < tickLower) {
      // console.log(5);

      if (amount0Desired == 0) {
        return 0;
      }
      // console.log(6);
    }

    // If entirely below current tick (including boundary), we only need token1
    else if (currentTick >= tickUpper) {
      // console.log(7);
      if (amount1Desired == 0) {
        return 0;
      }
      // console.log(8);
    }
    // console.log(9);

    (uint256 positionId, , , ) = _nftManager().mint(
      INonfungiblePositionManager.MintParams({
        token0: token0,
        token1: token1,
        deployer: pluginDeployer,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: address(this),
        deadline: block.timestamp
      })
    );

    // Approve and enter farming center
    _approveAndEnterFarming(positionId);

    return uint32(positionId);
  }

  /// @notice mints base position
  /// @param _baseLower lower tick of the base position
  /// @param _baseUpper upper tick of the base position
  /// @param amount0Desired desired amount of token0
  /// @param amount1Desired desired amount of token1
  function _mintBasePosition(
    int24 _currentTick,
    int24 _baseLower,
    int24 _baseUpper,
    uint256 amount0Desired,
    uint256 amount1Desired
  ) internal returns (uint32 _basePositionId) {
    _basePositionId = _mintPosition(_currentTick, _baseLower, _baseUpper, amount0Desired, amount1Desired);
  }

  /// @notice mints limit position
  /// @param _limitLower lower tick of the limit position
  /// @param _limitUpper upper tick of the limit position
  /// @param amount0Desired desired amount of token0
  /// @param amount1Desired desired amount of token1
  function _mintLimitPosition(
    int24 _currentTick,
    int24 _limitLower,
    int24 _limitUpper,
    uint256 amount0Desired,
    uint256 amount1Desired
  ) internal returns (uint32 _limitPositionId) {
    _limitPositionId = _mintPosition(_currentTick, _limitLower, _limitUpper, amount0Desired, amount1Desired);
  }

  /** @notice Helper function to get the most conservative price
     @param spot Current spot price
     @param twap TWAP price
     @param auxTwap Auxiliary TWAP price
     @param isPool Flag indicating if the valuation is for the pool or deposit
     @return price Most conservative price
    */
  function _getConservativePrice(uint256 spot, uint256 twap, uint256 auxTwap, bool isPool) internal view returns (uint256) {
    if (isPool) {
      // For pool valuation, use highest price to be conservative
      if (auxTwapPeriod > 0) {
        return max(max(spot, twap), auxTwap);
      }
      return max(spot, twap);
    } else {
      // For deposit valuation, use lowest price to be conservative
      if (auxTwapPeriod > 0) {
        return min(min(spot, twap), auxTwap);
      }
      return min(spot, twap);
    }
  }

  /**
     @notice Helper function to check price manipulation
     @param price Current spot price
     @param twap TWAP price
     @param auxTwap Auxiliary TWAP price
    */
  function _checkPriceManipulation(uint256 price, uint256 twap, uint256 auxTwap) internal view {
    uint256 delta = (price > twap) ? price.sub(twap).mul(PRECISION).div(price) : twap.sub(price).mul(PRECISION).div(twap);

    if (auxTwapPeriod > 0) {
      uint256 auxDelta = (price > auxTwap) ? price.sub(auxTwap).mul(PRECISION).div(price) : auxTwap.sub(price).mul(PRECISION).div(auxTwap);

      if (delta > hysteresis || auxDelta > hysteresis)
        if (!checkHysteresis()) revert InvalidDeposit();
    } else if (delta > hysteresis) {
      if (!checkHysteresis()) revert InvalidDeposit();
    }
  }

  /**
     @notice Distributes shares based on token1 value, adjusted by liquidity shares and pool's AUM in token1.
     @param deposit0 Token0 amount transferred from sender to AlgebraVault.
     @param deposit1 Token1 amount transferred from sender to AlgebraVault.
     @param to Recipient address for minted liquidity tokens.
     @return shares Number of liquidity tokens minted for deposit.
     */
  function deposit(uint256 deposit0, uint256 deposit1, address to) external override nonReentrant returns (uint256 shares) {
    if (!(allowToken0 || deposit0 == 0)) revert InvalidDeposit();
    if (!(allowToken1 || deposit1 == 0)) revert InvalidDeposit();
    if (!(deposit0 > 0 || deposit1 > 0)) revert InvalidDeposit();
    if (!(deposit0 < deposit0Max && deposit1 < deposit1Max)) revert InvalidDeposit();
    if (to == NULL_ADDRESS || to == address(this)) revert ZeroAddress();

    // Get spot price
    uint256 price = _fetchSpot(token0, token1, currentTick(), PRECISION);

    // Get TWAP price
    uint256 twap = _fetchTwap(token0, token1, twapPeriod, PRECISION);

    // Get aux TWAP price if aux period is set (otherwise set it equal to the TWAP price)
    uint256 auxTwap = auxTwapPeriod > 0 ? _fetchTwap(token0, token1, auxTwapPeriod, PRECISION) : twap;

    // Check price manipulation
    _checkPriceManipulation(price, twap, auxTwap);

    // Clean positions and collect/distribute fees
    _cleanPositions(true);

    // Get total amounts including current positions with updated fees
    (uint256 pool0, uint256 pool1) = getTotalAmounts();

    uint256 _totalSupply = totalSupply();

    // this should not happen, safety check against withdrawal fees overflowing both positions
    if (!(pool0 > 0 || pool1 > 0 || _totalSupply == 0)) revert EmptyVault();

    // Transfer tokens from depositor
    if (deposit0 > 0) {
      IERC20(token0).safeTransferFrom(msg.sender, address(this), deposit0);
    }
    if (deposit1 > 0) {
      IERC20(token1).safeTransferFrom(msg.sender, address(this), deposit1);
    }

    // Calculate share value in token1
    uint256 priceForDeposit = _getConservativePrice(price, twap, auxTwap, false);
    uint256 deposit0PricedInToken1 = deposit0.mul(priceForDeposit).div(PRECISION);

    // Calculate shares to mint
    shares = deposit1.add(deposit0PricedInToken1);

    if (_totalSupply != 0) {
      uint256 priceForPool = _getConservativePrice(price, twap, auxTwap, true);
      uint256 pool0PricedInToken1 = pool0.mul(priceForPool).div(PRECISION);
      shares = shares.mul(_totalSupply).div(pool0PricedInToken1.add(pool1));
      if (shares == 0) revert InvalidDeposit();
    } else {
      shares = shares.mul(MIN_SHARES);
    }

    _mint(to, shares);
    emit Deposit(msg.sender, to, shares, deposit0, deposit1);
  }

  /**
    @notice Decreases liquidity from NFT position proportional to shares
    @param positionId NFT position ID
    @param shares Amount of shares being withdrawn
    @param totalSupply Total supply of shares
    @param to Address to receive tokens
    @return amount0 Token0 amount withdrawn
    @return amount1 Token1 amount withdrawn
    */
  function _withdrawFromPosition(
    uint256 positionId,
    uint256 shares,
    uint256 totalSupply,
    address to
  ) internal returns (uint256 amount0, uint256 amount1) {
    // this function is always called after _cleanPositions is already called

    // Get position info
    (, , , , , , , uint128 positionLiquidity, , , uint128 tokensOwed0, uint128 tokensOwed1) = _nftManager().positions(positionId);

    // should not be happening, safety check
    if (!(tokensOwed0 == 0 && tokensOwed1 == 0)) revert TokensOwed();

    // Calculate proportional liquidity
    uint128 liquidityToDecrease = uint128(uint256(positionLiquidity).mul(shares).div(totalSupply));

    if (liquidityToDecrease > 0) {
      // Decrease liquidity
      (amount0, amount1) = _nftManager().decreaseLiquidity(
        INonfungiblePositionManager.DecreaseLiquidityParams({
          tokenId: positionId,
          liquidity: liquidityToDecrease,
          amount0Min: 0,
          amount1Min: 0,
          deadline: block.timestamp
        })
      );

      // Collect tokens
      _nftManager().collect(
        INonfungiblePositionManager.CollectParams({tokenId: positionId, recipient: to, amount0Max: uint128(amount0), amount1Max: uint128(amount1)})
      );
    }
  }
  /**
     @notice Redeems shares for a proportion of AlgebraVault's AUM, matching the share percentage of total issued.
     @param shares Quantity of liquidity tokens to redeem as pool assets.
     @param to Address receiving the redeemed pool assets.
     @return amount0 Token0 amount received from liquidity token redemption.
     @return amount1 Token1 amount received from liquidity token redemption.
     */
  function withdraw(uint256 shares, address to) external override nonReentrant returns (uint256 amount0, uint256 amount1) {
    if (shares == 0) revert ZeroValue();
    if (to == NULL_ADDRESS) revert ZeroAddress();

    uint256 _totalSupply = totalSupply();
    if (!(shares == _totalSupply || _totalSupply >= shares.add(MIN_SHARES))) revert InvalidDeposit();

    // Clean positions and collect/distribute fees
    _cleanPositions(true);

    // Withdraw from positions
    uint256 base0;
    uint256 base1;
    uint256 limit0;
    uint256 limit1;

    if (basePositionId != 0) {
      (base0, base1) = _withdrawFromPosition(basePositionId, shares, _totalSupply, to);
    }

    if (limitPositionId != 0) {
      (limit0, limit1) = _withdrawFromPosition(limitPositionId, shares, _totalSupply, to);
    }

    // Add proportional share of unused balances
    uint256 unusedAmount0 = IERC20(token0).balanceOf(address(this)).mul(shares).div(_totalSupply);
    uint256 unusedAmount1 = IERC20(token1).balanceOf(address(this)).mul(shares).div(_totalSupply);
    if (unusedAmount0 > 0) IERC20(token0).safeTransfer(to, unusedAmount0);
    if (unusedAmount1 > 0) IERC20(token1).safeTransfer(to, unusedAmount1);

    // Calculate total amounts returned
    amount0 = base0.add(limit0).add(unusedAmount0);
    amount1 = base1.add(limit1).add(unusedAmount1);

    _burn(msg.sender, shares);

    emit Withdraw(msg.sender, to, shares, amount0, amount1);
  }

  /**
     @notice Updates LP positions in the AlgebraVault.
     @dev Uses the new rebalance method from NonfungiblePositionManager to atomically
     burn liquidity from old ranges and mint in new ranges.
     @param _baseLower Lower tick of the base position.
     @param _baseUpper Upper tick of the base position.
     @param _limitLower Lower tick of the limit position.
     @param _limitUpper Upper tick of the limit position.
     @param swapQuantity Token swap quantity; positive for token0 to token1, negative for token1 to token0.
     */
  function rebalance(
    int24 _baseLower,
    int24 _baseUpper,
    int24 _limitLower,
    int24 _limitUpper,
    int256 swapQuantity
  ) external override nonReentrant onlyRebalancerOrRebalanceManager {
    // console.log(IERC20(token0).balanceOf(address(this)));
    // console.log(IERC20(token1).balanceOf(address(this)));

    // // console.log(1);
    if (!(_baseLower < _baseUpper && _baseLower % tickSpacing == 0 && _baseUpper % tickSpacing == 0)) {
      revert InvalidPosition();
    }
    if (!(_limitLower < _limitUpper && _limitLower % tickSpacing == 0 && _limitUpper % tickSpacing == 0)) {
      revert InvalidPosition();
    }
    if (!(_baseLower != _limitLower || _baseUpper != _limitUpper)) revert IdenticalPositions();

    (uint32 _basePositionId, uint32 _limitPositionId) = (basePositionId, limitPositionId);

    // collect rewards from farming and collect fees
    uint256 fees0 = 0;
    uint256 fees1 = 0;

    if (_basePositionId != 0) {
      (fees0, fees1) = _collectRewardsAndAccrueFees(_basePositionId, 0, 0);
    }
    if (_limitPositionId != 0) {
      (fees0, fees1) = _collectRewardsAndAccrueFees(_limitPositionId, fees0, fees1);
    }

    _distributeFees(fees0, fees1);

    // swap tokens if required (before rebalancing positions)
    if (swapQuantity != 0) {
      IAlgebraPool(pool).swap(
        address(this),
        swapQuantity > 0,
        swapQuantity > 0 ? swapQuantity : -swapQuantity,
        swapQuantity > 0 ? UV3Math.MIN_SQRT_RATIO + 1 : UV3Math.MAX_SQRT_RATIO - 1,
        abi.encode(address(this))
      );
    }

    // Rebalance positions using the new rebalance method from NonfungiblePositionManager
    if (_basePositionId != 0) {
      // console.log('base rebalance');
      _nftManager().rebalance(
        INonfungiblePositionManager.RebalanceParams({
          tokenId: _basePositionId,
          tickLower: _baseLower,
          tickUpper: _baseUpper,
          deadline: block.timestamp
        })
      );
    } else {
      // console.log('base mint');

      // If no base position exists, create a new one
      int24 currentTick = currentTick();
      _basePositionId = _mintBasePosition(
        currentTick,
        _baseLower,
        _baseUpper,
        IERC20(token0).balanceOf(address(this)),
        IERC20(token1).balanceOf(address(this))
      );
    }

    if (_limitPositionId != 0) {
      // console.log('limit rebalance');

      _nftManager().rebalance(
        INonfungiblePositionManager.RebalanceParams({
          tokenId: _limitPositionId,
          tickLower: _limitLower,
          tickUpper: _limitUpper,
          deadline: block.timestamp
        })
      );
    } else {
      // console.log('limit mint');

      // If no limit position exists, create a new one
      int24 currentTick = currentTick();
      _limitPositionId = _mintLimitPosition(
        currentTick,
        _limitLower,
        _limitUpper,
        IERC20(token0).balanceOf(address(this)),
        IERC20(token1).balanceOf(address(this))
      );
    }

    uint256 balance0 = IERC20(token0).balanceOf(address(this));
    uint256 balance1 = IERC20(token1).balanceOf(address(this));

    // console.log(IERC20(token0).balanceOf(address(this)));
    // console.log(IERC20(token1).balanceOf(address(this)));

    emit Rebalance(currentTick(), balance0, balance1, fees0, fees1, totalSupply());

    (basePositionId, limitPositionId) = (_basePositionId, _limitPositionId);

    // // console.log(basePositionId);
    // // console.log(limitPositionId);
  }

  /**
     @notice Collects and distributes fees from AlgebraVault's LP positions. Transaction can be paid by anyone.
     @return fees0 Collected fees in token0.
     @return fees1 Collected fees in token1.
     */
  function collectFees() external override nonReentrant returns (uint256 fees0, uint256 fees1) {
    (uint256 _fees0, uint256 _fees1) = _cleanPositions(true);
    return (_fees0, _fees1);
  }

  /// @notice min function
  function min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }

  /// @notice max function
  function max(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? b : a;
  }

  /**
     @notice Sends portion of swap fees to ammFeeRecepient, feeRecipient and affiliate.
     @param fees0 fees for token0
     @param fees1 fees for token1
     */
  function _distributeFees(uint256 fees0, uint256 fees1) internal {
    uint256 ammFee = IAlgebraVaultFactory(algebraVaultFactory).ammFee();
    uint256 baseFee = IAlgebraVaultFactory(algebraVaultFactory).baseFee();

    // Make sure there are always enough fees to distribute
    fees0 = min(fees0, IERC20(token0).balanceOf(address(this)));
    fees1 = min(fees1, IERC20(token1).balanceOf(address(this)));

    // baseFeeRecipient cannot be NULL. This is checked and controlled in the factory
    // ammFeeRecipient could be NULL, in this case ammFees are not taken
    // ammFee + baseFee is always <= 100%. Also controlled in the factory

    if (ammFee > 0 && ammFeeRecipient != NULL_ADDRESS) {
      if (fees0 > 0) {
        IERC20(token0).safeTransfer(ammFeeRecipient, fees0.mul(ammFee).div(PRECISION));
      }
      if (fees1 > 0) {
        IERC20(token1).safeTransfer(ammFeeRecipient, fees1.mul(ammFee).div(PRECISION));
      }
    }

    if (baseFee > 0) {
      // if there is no affiliate 100% of the baseFee should go to feeRecipient
      uint256 baseFeeSplit = (affiliate == NULL_ADDRESS) ? PRECISION : IAlgebraVaultFactory(algebraVaultFactory).baseFeeSplit();
      address feeRecipient = IAlgebraVaultFactory(algebraVaultFactory).feeRecipient();

      if (fees0 > 0) {
        uint256 totalFee = fees0.mul(baseFee).div(PRECISION);
        uint256 toRecipient = totalFee.mul(baseFeeSplit).div(PRECISION);
        uint256 toAffiliate = totalFee.sub(toRecipient);
        IERC20(token0).safeTransfer(feeRecipient, toRecipient);
        if (toAffiliate > 0) {
          IERC20(token0).safeTransfer(affiliate, toAffiliate);
        }
      }
      if (fees1 > 0) {
        uint256 totalFee = fees1.mul(baseFee).div(PRECISION);
        uint256 toRecipient = totalFee.mul(baseFeeSplit).div(PRECISION);
        uint256 toAffiliate = totalFee.sub(toRecipient);
        IERC20(token1).safeTransfer(feeRecipient, toRecipient);
        if (toAffiliate > 0) {
          IERC20(token1).safeTransfer(affiliate, toAffiliate);
        }
      }
    }
  }

  /**
     @notice Checks if the last price change happened in the current block
     */
  function checkHysteresis() private view returns (bool) {
    address basePlugin = _getBasePluginFromPool();

    // get latest timestamp from the plugin
    (, uint32 blockTimestamp) = UV3Math.lastTimepointMetadata(basePlugin);
    return (block.timestamp != blockTimestamp);
  }

  /**
     @notice Returns the current fee in the pool
     @return fee_ current fee in the pool
     */
  function fee() external view override returns (uint24 fee_) {
    (, , fee_, , , ) = IAlgebraPool(pool).globalState();
  }

  /**
     @notice Sets the hysteresis threshold, in percentage points (10**16 = 1%). Triggers a flashloan attack
     check when the difference between spot price and TWAP exceeds this threshold.
     @dev Accessible only by the owner.
     @param _hysteresis Hysteresis threshold value.
     */
  function setHysteresis(uint256 _hysteresis) external override onlyManager {
    hysteresis = _hysteresis;
    emit Hysteresis(msg.sender, _hysteresis);
  }

  /**
     @notice Sets the AMM fee recipient account address, where portion of the collected swap fees will be distributed
     @dev onlyManager
     @param _ammFeeRecipient The AMM fee recipient account address
     */
  function setAmmFeeRecipient(address _ammFeeRecipient) external override onlyManager {
    ammFeeRecipient = _ammFeeRecipient;
    emit AmmFeeRecipient(msg.sender, _ammFeeRecipient);
  }

  /**
     @notice Sets the affiliate account address where portion of the collected swap fees will be distributed
     @dev onlyManager
     @param _affiliate The affiliate account address
     */
  function setAffiliate(address _affiliate) external override onlyManager {
    affiliate = _affiliate;
    emit Affiliate(msg.sender, _affiliate);
  }

  /**
     @notice Sets the contract address where farming rewards will be sent
     @dev onlyManager
     @param _farmingRewardsDistributor The farming rewards distributor contract address
     */
  function setFarmingRewardsDistributor(address _farmingRewardsDistributor) external override onlyManager {
    if (_farmingRewardsDistributor == address(0)) revert ZeroAddress();
    farmingRewardsDistributor = _farmingRewardsDistributor;
    emit FarmingContract(msg.sender, _farmingRewardsDistributor);
  }

  /**
     @notice Sets the rebalance manager address which will be allowed to call rebalance() function
     @dev onlyManager
     @param _rebalanceManager The rebalance manager address
     */
  function setRebalanceManager(address _rebalanceManager) external override onlyManager {
    rebalanceManager = _rebalanceManager;
    emit RebalanceManager(msg.sender, _rebalanceManager);
  }

  /**
     @notice Sets the maximum token0 and token1 amounts the contract allows in a deposit
     @dev onlyManager
     @param _deposit0Max The maximum amount of token0 allowed in a deposit
     @param _deposit1Max The maximum amount of token1 allowed in a deposit
     */
  function setDepositMax(uint256 _deposit0Max, uint256 _deposit1Max) external override onlyRebalancerOrRebalanceManager {
    deposit0Max = _deposit0Max;
    deposit1Max = _deposit1Max;
    emit DepositMax(msg.sender, _deposit0Max, _deposit1Max);
  }

  /**
     @notice Calculates total quantity of token0 and token1 in both positions (and unused in the AlgebraVault)
     @return total0 Quantity of token0 in both positions (and unused in the AlgebraVault)
     @return total1 Quantity of token1 in both positions (and unused in the AlgebraVault)
     */
  function getTotalAmounts() public view override returns (uint256 total0, uint256 total1) {
    (, uint256 base0, uint256 base1) = getBasePosition();
    (, uint256 limit0, uint256 limit1) = getLimitPosition();
    total0 = IERC20(token0).balanceOf(address(this)).add(base0).add(limit0);
    total1 = IERC20(token1).balanceOf(address(this)).add(base1).add(limit1);
  }

  /**
   * @notice Gets position info and calculates token amounts for a given NFT position
   * @param positionId NFT position ID to query
   * @return liquidity Amount of liquidity in the position
   * @return amount0 Amount of token0 in position (including fees)
   * @return amount1 Amount of token1 in position (including fees)
   */
  function _getPositionAmounts(uint256 positionId) internal view returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
    if (positionId == 0) {
      return (0, 0, 0);
    }

    // Get current position info from NFT manager
    (, , , , , int24 tickLower, int24 tickUpper, uint128 positionLiquidity, , , uint128 tokensOwed0, uint128 tokensOwed1) = _nftManager().positions(
      positionId
    );

    // Get current price from pool for amount calculation
    (uint160 sqrtRatioX96, , , , , ) = IAlgebraPool(pool).globalState();

    // Calculate amounts for the current liquidity
    (amount0, amount1) = UV3Math.getAmountsForLiquidity(
      sqrtRatioX96,
      UV3Math.getSqrtRatioAtTick(tickLower),
      UV3Math.getSqrtRatioAtTick(tickUpper),
      positionLiquidity
    );

    // Add any uncollected fees
    amount0 = amount0.add(uint256(tokensOwed0));
    amount1 = amount1.add(uint256(tokensOwed1));
    liquidity = positionLiquidity;
  }

  /**
   * @notice Gets position liquidity for a given NFT position
   * @param positionId NFT position ID to query
   * @return liquidity Amount of liquidity in the position
   */
  function _getPositionLiquidity(uint256 positionId) internal view returns (uint128 liquidity) {
    if (positionId == 0) {
      return 0;
    }

    // Get current position info from NFT manager
    (, , , , , , , uint128 positionLiquidity, , , , ) = _nftManager().positions(positionId);
    liquidity = positionLiquidity;
  }

  /**
     @notice Calculates amount of total liquidity in the base position
     @return liquidity Amount of total liquidity in the base position
     @return amount0 Estimated amount of token0 that could be collected by burning the base position
     @return amount1 Estimated amount of token1 that could be collected by burning the base position
     */
  function getBasePosition() public view override returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
    return _getPositionAmounts(basePositionId);
  }

  /**
     @notice Calculates amount of total liquidity in the limit position
     @return liquidity Amount of total liquidity in the base position
     @return amount0 Estimated amount of token0 that could be collected by burning the limit position
     @return amount1 Estimated amount of token1 that could be collected by burning the limit position
     */
  function getLimitPosition() public view override returns (uint128 liquidity, uint256 amount0, uint256 amount1) {
    return _getPositionAmounts(limitPositionId);
  }

  /**
     @notice Returns current price tick
     @return tick Uniswap pool's current price tick
     */
  function currentTick() public view override returns (int24) {
    (, int24 tick_, , , , bool unlocked_) = IAlgebraPool(pool).globalState();
    if (!unlocked_) revert InvalidDeposit();
    return tick_;
  }

  /**
     @notice returns equivalent _tokenOut for _amountIn, _tokenIn using spot price
     @param _tokenIn token the input amount is in
     @param _tokenOut token for the output amount
     @param _tick tick for the spot price
     @param _amountIn amount in _tokenIn
     @return amountOut equivalent anount in _tokenOut
     */
  function _fetchSpot(address _tokenIn, address _tokenOut, int24 _tick, uint256 _amountIn) internal pure returns (uint256 amountOut) {
    return UV3Math.getQuoteAtTick(_tick, UV3Math.toUint128(_amountIn), _tokenIn, _tokenOut);
  }

  /**
     @notice returns equivalent _tokenOut for _amountIn, _tokenIn using TWAP price
     @param _tokenIn token the input amount is in
     @param _tokenOut token for the output amount
     @param _twapPeriod the averaging time period
     @param _amountIn amount in _tokenIn
     @return amountOut equivalent anount in _tokenOut
     */
  function _fetchTwap(address _tokenIn, address _tokenOut, uint32 _twapPeriod, uint256 _amountIn) internal view returns (uint256 amountOut) {
    // Leave twapTick as a int256 to avoid solidity casting
    address basePlugin = _getBasePluginFromPool();

    int256 twapTick = UV3Math.consult(basePlugin, _twapPeriod);
    return
      UV3Math.getQuoteAtTick(
        int24(twapTick), // can assume safe being result from consult()
        UV3Math.toUint128(_amountIn),
        _tokenIn,
        _tokenOut
      );
  }

  /**
     @notice Callback function for swap
     @dev this is where the payer transfers required token0 and token1 amounts
     @param amount0Delta required amount of token0
     @param amount1Delta required amount of token1
     */
  function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external override {
    if (msg.sender != address(pool)) revert InvalidDeposit();

    if (amount0Delta > 0) {
      IERC20(token0).safeTransfer(msg.sender, uint256(amount0Delta));
    } else if (amount1Delta > 0) {
      IERC20(token1).safeTransfer(msg.sender, uint256(amount1Delta));
    }
  }

  function _getBasePluginFromPool() private view returns (address basePlugin) {
    basePlugin = IAlgebraPool(pool).plugin();
    // make sure the base plugin is connected to the pool
    if (!UV3Math.isOracleConnectedToPool(basePlugin, pool)) revert AlgebraDisconnectedPlugin();
  }
}
