// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '../interfaces/plugins/ISecurityRegistry.sol';

contract SecurityRegistry is ISecurityRegistry {
  using EnumerableSet for EnumerableSet.AddressSet;
  address public immutable override algebraFactory;
  bytes32 public constant override GUARD = keccak256('GUARD');

  Status public override globalStatus;
  bool public override isPoolStatusOverrided;
  EnumerableSet.AddressSet private overriddenPools;

  mapping(address => Status) public poolStatus;

  constructor(address _algebraFactory) {
    algebraFactory = _algebraFactory;
  }

  function setPoolsStatus(address[] memory pools, Status[] memory newStatuses) external override {
    for (uint i = 0; i < pools.length; i++) {
      _hasAccess(newStatuses[i]);
      poolStatus[pools[i]] = newStatuses[i];

      if (newStatuses[i] == Status.ENABLED) {
        overriddenPools.remove(pools[i]);
      } else {
        overriddenPools.add(pools[i]);
      }
      emit PoolStatus(pools[i], newStatuses[i]);
    }

    if (overriddenPools.length() > 0) {
      isPoolStatusOverrided = true;
    } else {
      isPoolStatusOverrided = false;
    }
  }

  function setGlobalStatus(Status newStatus) external override {
    _hasAccess(newStatus);
    globalStatus = newStatus;
    emit GlobalStatus(newStatus);
  }

  function getPoolStatus(address pool) external view override returns (Status) {
    Status _globalStatus = globalStatus;
    bool _isPoolStatusOverrided = isPoolStatusOverrided;
    if (_isPoolStatusOverrided) {
      if (_globalStatus == Status.ENABLED) {
        return poolStatus[pool];
      } else {
        return _globalStatus;
      }
    } else {
      return _globalStatus;
    }
  }

  function _hasAccess(Status newStatus) internal view {
    if (newStatus == Status.ENABLED || newStatus == Status.BURN_ONLY) {
      require(msg.sender == IAlgebraFactory(algebraFactory).owner(), 'Only owner');
    } else {
      require(IAlgebraFactory(algebraFactory).hasRoleOrOwner(GUARD, msg.sender), 'Only guard');
    }
  }
}
