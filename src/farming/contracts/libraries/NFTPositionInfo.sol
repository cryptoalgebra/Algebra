// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPoolDeployer.sol';
import '@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/PoolAddress.sol';

/// @notice Encapsulates the logic for getting info about a NFT token ID
library NFTPositionInfo {
  /// @param deployer The address of the Algebra Deployer used in computing the pool address
  /// @param nonfungiblePositionManager The address of the nonfungible position manager to query
  /// @param tokenId The unique identifier of an Algebra LP token
  /// @return pool The address of the Algebra pool
  /// @return tickLower The lower tick of the Algebra position
  /// @return tickUpper The upper tick of the Algebra position
  /// @return liquidity The amount of liquidity farmd
  function getPositionInfo(
    IAlgebraPoolDeployer deployer,
    INonfungiblePositionManager nonfungiblePositionManager,
    uint256 tokenId
  ) internal view returns (IAlgebraPool pool, int24 tickLower, int24 tickUpper, uint128 liquidity) {
    address token0;
    address token1;
    (, , token0, token1, tickLower, tickUpper, liquidity, , , , ) = nonfungiblePositionManager.positions(tokenId);

    pool = IAlgebraPool(PoolAddress.computeAddress(address(deployer), PoolAddress.PoolKey({token0: token0, token1: token1})));
  }
}
