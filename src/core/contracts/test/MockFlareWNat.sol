// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

contract MockFlareWNat {
  event Delegated(address indexed user, address delegatee, uint256 bip);

  function batchDelegate(address[] memory _delegatees, uint256[] memory _bips) external {
    require(_delegatees.length == _bips.length, 'Array length mismatch');
    for (uint256 i = 0; i < _delegatees.length; i++) {
      emit Delegated(msg.sender, _delegatees[i], _bips[i]);
    }
  }
}
