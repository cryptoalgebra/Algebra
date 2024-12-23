// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '../interfaces/plugins/ISecurityRegistry.sol';

contract SecurityRegistry is ISecurityRegistry {
  address public immutable override algebraFactory;
  bytes32 public constant override GUARD = keccak256('GUARD');

  Status public override globalStatus;

  mapping(address => Status) public poolStatus;

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
  }

  function setPoolsStatus(address[] memory pools, Status[] memory newStatuses) external override {
    for (uint i = 0; i < pools.length; i++) {
      if (newStatuses[i] == Status.ENABLED || newStatuses[i] == Status.BURN_ONLY) {
        require(msg.sender == IAlgebraFactory(algebraFactory).owner(), 'Only owner');
      } else {
        require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(GUARD, msg.sender), 'Only guard');
      }
      poolStatus[pools[i]] = newStatuses[i];
      emit PoolStatus(pools[i], newStatuses[i]);
    }
  }

  function setGlobalStatus(Status newStatus) external override {
    globalStatus = newStatus;
    if (newStatus == Status.ENABLED || newStatus == Status.BURN_ONLY) {
      require(msg.sender == IAlgebraFactory(algebraFactory).owner(), 'Only owner');
    } else {
      require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(GUARD, msg.sender), 'Only guard');
    }
    emit GlobalStatus(newStatus);
  }

  function getPoolStatus(address pool) external view override returns (Status) {
    Status _globalStatus = globalStatus;
    if (_globalStatus == Status.ENABLED) {
      return poolStatus[pool];
    } else {
      return _globalStatus;
    }
  }
}
