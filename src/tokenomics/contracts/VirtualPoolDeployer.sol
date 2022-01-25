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

    /// @inheritdoc IVirtualPoolDeployer
    function setFarming(address _farming) external override onlyOwner {
        emit FarmingAddressChanged(farming, _farming);
        farming = _farming;
    }

    /// @inheritdoc IVirtualPoolDeployer
    function deploy(
        address poolAddress,
        address _farming,
        uint32 _desiredStartTimestamp,
        uint32 _desiredEndTimestamp
    ) external override onlyFarming returns (address virtualPool) {
        virtualPool = address(
            new AlgebraVirtualPool(poolAddress, _farming, _desiredStartTimestamp, _desiredEndTimestamp)
        );
    }
}
