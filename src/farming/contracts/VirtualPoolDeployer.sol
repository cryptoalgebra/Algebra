// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './interfaces/IVirtualPoolDeployer.sol';
import './AlgebraVirtualPool.sol';

contract VirtualPoolDeployer is IVirtualPoolDeployer {
    address private farming;
    address private owner;

    modifier onlyFarming() {
        require(msg.sender == farming);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // @inheritdoc IVirtualPoolDeployer
    function setFarming(address _farming) external override onlyOwner {
        require(farming == address(0));
        farming = _farming;
    }

    // @inheritdoc IVirtualPoolDeployer
    function deploy(address poolAddress, address _farming) external override onlyFarming returns (address virtualPool) {
        virtualPool = address(new AlgebraVirtualPool(poolAddress, _farming));
    }
}
