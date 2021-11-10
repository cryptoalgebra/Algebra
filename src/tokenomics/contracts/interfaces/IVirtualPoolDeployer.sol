// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/**
 * @title An interface for a contract that is capable of deploying Algebra virtual Pools
 */
interface IVirtualPoolDeployer {
    function deploy(address pool, address farming) external returns (address virtualPool);

    /**
     * @dev Sets the factory address to the poolDeployer for permissioned actions
     * @param tokenomics The address of the Algebra tokenomics
     */
    function setFarming(address farming) external;
}
