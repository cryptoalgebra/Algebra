// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import {AlgebraVault} from '../AlgebraVault.sol';

library AlgebraVaultDeployer {
  function createAlgebraVault(
    address pool,
    address token0,
    bool allowToken0,
    address token1,
    bool allowToken1,
    uint32 twapPeriod,
    uint256 vaultIndex
  ) public returns (address algebraVault) {
    algebraVault = address(
      new AlgebraVault{salt: keccak256(abi.encodePacked(msg.sender, token0, allowToken0, token1, allowToken1))}(
        pool,
        allowToken0,
        allowToken1,
        twapPeriod,
        vaultIndex
      )
    );
  }
}
