// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IVoter {

    function gaugeForPool(address pool) external view returns(address);

}