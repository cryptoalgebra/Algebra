// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

contract MockFlareContractRegistry {
  address public wnat;
  address public rewardsV2;

  function initialize(address _wnat, address _rewardsV2) external {
    wnat = _wnat;
    rewardsV2 = _rewardsV2;
  }

  function getContractAddressByName(string calldata _contractName) external view returns (address) {
    if (keccak256(abi.encode(_contractName)) == keccak256(abi.encode('WNat'))) return wnat;
    else if (keccak256(abi.encode(_contractName)) == keccak256(abi.encode('RewardsV2'))) return rewardsV2;
    revert('Invalid contract');
  }
}
