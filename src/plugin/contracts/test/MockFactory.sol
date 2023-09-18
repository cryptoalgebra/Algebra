// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

/// @title Mock of Algebra factory for plugins testing
contract MockFactory {
  bytes32 public constant POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR');

  address public owner;

  mapping(address => mapping(bytes32 => bool)) public hasRole;

  mapping(address => mapping(address => address)) public poolByPair;

  constructor() {
    owner = msg.sender;
  }

  function hasRoleOrOwner(bytes32 role, address account) public view returns (bool) {
    return (owner == account || hasRole[account][role]);
  }

  function grantRole(bytes32 role, address account) external {
    hasRole[account][role] = true;
  }

  function revokeRole(bytes32 role, address account) external {
    hasRole[account][role] = false;
  }

  function stubPool(address token0, address token1, address pool) public {
    poolByPair[token0][token1] = pool;
    poolByPair[token1][token0] = pool;
  }
}
