// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import './IAlgebraModuleFactory.sol';

interface IAlgebraFarmingModuleFactory is IAlgebraModuleFactory {
    /// @notice Emitted when the farming address is changed
    /// @param newFarmingAddress The farming address after the address was changed
    event FarmingAddress(address newFarmingAddress);

    /// @notice Returns current farming address
    /// @return The farming contract address
    function farmingAddress() external view returns (address);

    /// @dev updates farmings manager address on the factory
    /// @param newFarmingAddress The new tokenomics contract address
    function setFarmingAddress(address newFarmingAddress) external;
}
