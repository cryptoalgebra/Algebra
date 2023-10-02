// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '../interfaces/IAlgebraEternalVirtualPool.sol';
import '@cryptoalgebra/integral-periphery/contracts/interfaces/IPositionFollower.sol';

/// @dev Test contract for virtual pool onlyPool methods
contract NftPosManagerMock {
  struct Position {
    uint88 nonce; // the nonce for permits
    address operator; // the address that is approved for spending this token
    uint80 poolId; // the ID of the pool with which this token is connected
    int24 tickLower; // the tick range of the position
    int24 tickUpper;
    uint128 liquidity; // the liquidity of the position
    uint256 feeGrowthInside0LastX128; // the fee growth of the aggregate position as of the last action on the individual position
    uint256 feeGrowthInside1LastX128;
    uint128 tokensOwed0; // how many uncollected tokens are owed to the position, as of the last computation
    uint128 tokensOwed1;
  }

  mapping(uint256 => Position) public positions;

  address public poolDeployer;

  function setPosition(uint256 index, Position calldata _position) external {
    positions[index] = _position;
  }

  function applyLiquidityDeltaInFC(address farmingCenter, uint256 tokenId, int256 liquidityDelta) external {
    IPositionFollower(farmingCenter).applyLiquidityDelta(tokenId, liquidityDelta);
  }
}
