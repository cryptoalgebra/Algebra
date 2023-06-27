// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import './plugins/IVolatilityOracle.sol';
import './plugins/IDynamicFeeManager.sol';
import './plugins/IFarmingPlugin.sol';

/// @title The interface for the DataStorageOperator
/// @notice This contract combines the standard implementations of the volatility oracle and the dynamic fee manager
/// @dev This contract stores timepoints and calculates adaptive fee and statistical averages
interface IDataStorageOperator is IVolatilityOracle, IDynamicFeeManager, IFarmingPlugin {
  // used only for combining interfaces
}
