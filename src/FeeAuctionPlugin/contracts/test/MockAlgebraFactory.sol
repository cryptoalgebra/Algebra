// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

/// @title Mock Algebra Factory for testing
contract MockAlgebraFactory {
  bytes32 public constant POOLS_ADMINISTRATOR_ROLE = keccak256('POOLS_ADMINISTRATOR');

  address public owner;
  mapping(bytes32 => mapping(address => bool)) private roles;
  mapping(address => mapping(address => address)) public poolByPair;

  constructor() {
    owner = msg.sender;
  }

  function hasRoleOrOwner(bytes32 role, address account) external view returns (bool) {
    return account == owner || roles[role][account];
  }

  function grantRole(bytes32 role, address account) external {
    require(msg.sender == owner, 'Only owner');
    roles[role][account] = true;
  }

  function setPool(address token0, address token1, address pool) external {
    poolByPair[token0][token1] = pool;
    poolByPair[token1][token0] = pool;
  }
}
