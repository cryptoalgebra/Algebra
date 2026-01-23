// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

interface RewardsV2Interface {
  /// Claim type enum.
  enum ClaimType {
    DIRECT,
    FEE,
    WNAT,
    MIRROR,
    CCHAIN
  }

  /// Struct used for claiming rewards with Merkle proof.
  struct RewardClaimWithProof {
    bytes32[] merkleProof;
    RewardClaim body;
  }

  /// Struct used in Merkle tree for storing reward claims.
  struct RewardClaim {
    uint24 rewardEpochId;
    bytes20 beneficiary; // c-chain address or node id (bytes20) in case of type MIRROR
    uint120 amount; // in wei
    ClaimType claimType;
  }

  /// Struct used for returning state of rewards.
  struct RewardState {
    uint24 rewardEpochId;
    bytes20 beneficiary; // c-chain address or node id (bytes20) in case of type MIRROR
    uint120 amount; // in wei
    ClaimType claimType;
    bool initialised;
  }

  /**
   * Claim rewards for `_rewardOwner` and transfer them to `_recipient`.
   * It can be called by reward owner or its authorized executor.
   * @param _rewardOwner Address of the reward owner.
   * @param _recipient Address of the reward recipient.
   * @param _rewardEpochId Id of the reward epoch up to which the rewards are claimed.
   * @param _wrap Indicates if the reward should be wrapped (deposited) to the WNAT contract.
   * @param _proofs Array of reward claims with merkle proofs.
   * @return _rewardAmountWei Amount of rewarded native tokens (wei).
   */
  function claim(
    address _rewardOwner,
    address payable _recipient,
    uint24 _rewardEpochId,
    bool _wrap,
    RewardClaimWithProof[] calldata _proofs
  ) external returns (uint256 _rewardAmountWei);
}

contract MockFlareRewardsV2 is RewardsV2Interface {
  event Claimed(address indexed user, address rewardOwner, address recipient, uint24 rewardEpochId, bool wrap);

  function claim(
    address _rewardOwner,
    address payable _recipient,
    uint24 _rewardEpochId,
    bool _wrap,
    RewardClaimWithProof[] calldata _proofs
  ) external override returns (uint256 _rewardAmountWei) {
    emit Claimed(msg.sender, _rewardOwner, _recipient, _rewardEpochId, _wrap);
    _rewardAmountWei = _rewardEpochId * 2;
  }
}
