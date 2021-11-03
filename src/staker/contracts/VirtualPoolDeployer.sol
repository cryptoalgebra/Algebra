// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './interfaces/IVirtualPoolDeployer.sol';
import './AlgebraVirtualPool.sol';

contract VirtualPoolDeployer is IVirtualPoolDeployer {
    address private factory;
    address private owner;

    modifier onlyFactory() {
        require(msg.sender == factory);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // @inheritdoc IAlgebraPoolDeployer
    function setFactory(address _factory) external override onlyOwner {
        require(factory == address(0));
        factory = _factory;
    }

    // @inheritdoc IAlgebraPoolDeployer
    function deploy(address poolAddress, address staker) external override onlyFactory returns (address virtualPool) {
        virtualPool = address(new AlgebraVirtualPool(poolAddress, staker));
    }
}
