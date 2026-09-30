// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../AlgebraPoolExtension.sol';
import '../interfaces/IAlgebraPoolDeployer.sol';

/// @dev Mock extension that reads factory from deployer cache instead of msg.sender
contract MockAlgebraPoolExtension is AlgebraPoolExtension {
  function _getDeployParameters() internal view override returns (address, address, address, address, address) {
    return IAlgebraPoolDeployer(msg.sender).getDeployParameters();
  }
}
