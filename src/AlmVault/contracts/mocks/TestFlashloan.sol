// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/callback/IAlgebraFlashCallback.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/PoolAddress.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/CallbackValidation.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/TransferHelper.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IAlgebraVault {
  function deposit(uint256 amount0, uint256 amount1, address to) external returns (uint256 shares);
  function withdraw(uint256 shares, address to) external returns (uint256 amount0, uint256 amount1);
  function balanceOf(address account) external view returns (uint256);
}

/// @title Simple Flash contract for testing
/// @notice A simple contract to test Algebra flash functionality
contract PairFlash is IAlgebraFlashCallback {
  address public immutable factory;
  address public immutable poolDeployer;
  address public immutable almVault;

  // Events for debugging
  event FlashLoanExecuted(uint256 amount0, uint256 amount1, uint256 fee0, uint256 fee1);
  event FlashInitiated(address pool, uint256 amount0, uint256 amount1);
  event CallbackReceived(address token0, address token1, uint256 fee0, uint256 fee1);
  event BalanceCheck(address token, uint256 balance, uint256 needed);
  event VaultDeposit(address vault, uint256 shares, uint256 amount0, uint256 amount1);
  event VaultWithdraw(address vault, uint256 shares, uint256 amount0, uint256 amount1);

  constructor(address _factory, address _poolDeployer, address _almVault) {
    factory = _factory;
    poolDeployer = _poolDeployer;
    almVault = _almVault;
  }

  /// @notice Implements the callback called from flash
  /// @dev Simply pays back the borrowed amount plus fees
  function algebraFlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external override {
    FlashCallbackData memory decoded = abi.decode(data, (FlashCallbackData));

    // Verify callback is from valid pool
    CallbackValidation.verifyCallback(poolDeployer, decoded.poolKey);

    address token0 = decoded.poolKey.token0;
    address token1 = decoded.poolKey.token1;

    emit CallbackReceived(token0, token1, fee0, fee1);

    IAlgebraVault vault = IAlgebraVault(almVault);
    if (decoded.amount0 > 0) {
      TransferHelper.safeApprove(token0, almVault, decoded.amount0);
    }
    if (decoded.amount1 > 0) {
      TransferHelper.safeApprove(token1, almVault, decoded.amount1);
    }

    uint256 shares = vault.deposit(decoded.amount0, 0, address(this));
    emit VaultDeposit(almVault, shares, decoded.amount0, decoded.amount1);

    (uint256 withdrawnAmount0, uint256 withdrawnAmount1) = vault.withdraw(shares, address(this));
    emit VaultWithdraw(almVault, shares, withdrawnAmount0, withdrawnAmount1);

    // Calculate amounts to pay back (borrowed + fees)
    uint256 amount0Owed = decoded.amount0 + fee0;
    uint256 amount1Owed = decoded.amount1 + fee1;

    // Check balances before paying back
    if (amount0Owed > 0) {
      uint256 balance0 = IERC20(token0).balanceOf(address(this));
      emit BalanceCheck(token0, balance0, amount0Owed);
      require(balance0 >= amount0Owed, 'PairFlash: insufficient token0 balance');
      TransferHelper.safeTransfer(token0, msg.sender, amount0Owed);
    }

    if (amount1Owed > 0) {
      uint256 balance1 = IERC20(token1).balanceOf(address(this));
      emit BalanceCheck(token1, balance1, amount1Owed);
      require(balance1 >= amount1Owed, 'PairFlash: insufficient token1 balance');
      TransferHelper.safeTransfer(token1, msg.sender, amount1Owed);
    }

    // Emit event for testing
    emit FlashLoanExecuted(decoded.amount0, decoded.amount1, fee0, fee1);
  }

  struct FlashParams {
    address token0;
    address token1;
    address deployer;
    uint256 amount0;
    uint256 amount1;
  }

  struct FlashCallbackData {
    uint256 amount0;
    uint256 amount1;
    address payer;
    PoolAddress.PoolKey poolKey;
  }

  /// @notice Initiates a flash loan
  /// @param params The parameters for the flash loan
  function initFlash(FlashParams memory params) external returns (address) {
    require(params.token0 != address(0), 'PairFlash: token0 is zero address');
    require(params.token1 != address(0), 'PairFlash: token1 is zero address');
    require(params.amount0 > 0 || params.amount1 > 0, 'PairFlash: both amounts are zero');

    PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey({deployer: address(0), token0: params.token0, token1: params.token1});

    IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));
    require(address(pool) != address(0), 'PairFlash: pool address is zero');

    // Check if pool exists by checking code size
    uint256 codeSize;
    assembly {
      codeSize := extcodesize(pool)
    }
    if (codeSize == 0) {
      revert('PairFlash: pool does not exist');
    }

    emit FlashInitiated(address(pool), params.amount0, params.amount1);

    pool.flash(
      address(this),
      params.amount0,
      params.amount1,
      abi.encode(FlashCallbackData({amount0: params.amount0, amount1: params.amount1, payer: msg.sender, poolKey: poolKey}))
    );
    return address(pool);
  }

  /// @notice Emergency function to withdraw tokens
  function emergencyWithdraw(address token, uint256 amount) external {
    TransferHelper.safeTransfer(token, msg.sender, amount);
  }

  /// @notice Check token balance
  function getBalance(address token) external view returns (uint256) {
    return IERC20(token).balanceOf(address(this));
  }

  function getPool(address token0, address token1) external view returns (address) {
    return PoolAddress.computeAddress(poolDeployer, PoolAddress.PoolKey({deployer: address(0), token0: token0, token1: token1}));
  }
}
