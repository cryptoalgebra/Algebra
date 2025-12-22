// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import '@cryptoalgebra/integral-periphery/contracts/interfaces/ISwapRouter.sol';
import '../interfaces/IAlgebraVault.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @notice Helper contract to test hysteresis by executing swap and deposit in same transaction
contract TestDepositHelper {
  /// @notice Execute swap and deposit in the same transaction to trigger hysteresis check
  /// @param router The swap router address
  /// @param vault The vault address
  /// @param tokenIn Token to swap in
  /// @param tokenOut Token to swap out
  /// @param deployer Plugin deployer address
  /// @param swapAmount Amount to swap
  /// @param depositAmount Amount to deposit after swap
  /// @param recipient Address to receive vault shares
  function swapAndDeposit(
    address router,
    address vault,
    address tokenIn,
    address tokenOut,
    address deployer,
    uint256 swapAmount,
    uint256 depositAmount,
    address recipient
  ) external {
    // Transfer tokens from sender
    IERC20(tokenIn).transferFrom(msg.sender, address(this), swapAmount + depositAmount);

    // Approve router for swap
    IERC20(tokenIn).approve(router, swapAmount);

    // Execute swap
    ISwapRouter(router).exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        recipient: address(this),
        deployer: deployer,
        deadline: block.timestamp,
        amountIn: swapAmount,
        amountOutMinimum: 0,
        limitSqrtPrice: 0
      })
    );

    // Approve vault for deposit
    IERC20(tokenIn).approve(vault, depositAmount);

    // Attempt deposit (should revert due to hysteresis if timestamps match)
    IAlgebraVault(vault).deposit(depositAmount, 0, recipient);
  }
}
