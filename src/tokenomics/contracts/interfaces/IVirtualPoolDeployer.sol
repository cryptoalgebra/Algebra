// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/**
 * @title An interface for a contract that is capable of deploying Algebra virtual Pools
 */
interface IVirtualPoolDeployer {
    function deploy(
        address pool,
        address farming,
        uint32 desiredStartTimestamp,
        uint32 desiredEndTimestamp
    ) external returns (address virtualPool);

    /**
     * @dev Sets the factory address to the poolDeployer for permissioned actions
     * @param farming The address of the Algebra framing
     */
    function setFarming(address farming) external;

    /**
     * @notice Emitted when the farming address is changed
     * @param farming The farming address before the address was changed
     * @param _farming The farming address after the address was changed
     */
    event FarmingAddressChanged(address indexed farming, address indexed _farming);
}
