// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

// Blast Contract Interface
interface IBlast {
    function configureClaimableYield() external;
    function configureClaimableGas() external;
    function configureGovernor(address _governor) external;
}
