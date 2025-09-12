// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/// @title Interface for Algebra Vault
/// @notice Interface for managing fee collection and distribution for Algebra pools
interface IAlgebraVault {
    
    /// @notice Role identifier for fee vault managers
    function FEE_VAULT_MANAGER_ROLE() external view returns (bytes32);

    /// @notice The address of the vault factory contract
    function factory() external view returns (address);

    /// @notice The address of the associated Algebra pool
    function pool() external view returns (address);

    /// @notice The address of the voter contract
    function voter() external view returns (address);


    /// @notice Withdraws tokens from the vault
    /// @param to The address to receive the withdrawn tokens
    /// @param token Array of token addresses to withdraw
    /// @param amount Array of amounts to withdraw for each token
    /// @dev Only callable by accounts with FEE_VAULT_MANAGER_ROLE
    function withdraw(address to, address[] calldata token, uint256[] calldata amount) external;

    /// @notice Distributes the accumulated fees to the gauge and theNFT receiver
    /// @return _claimed0 Amount of token0 sent to gauge
    /// @return _claimed1 Amount of token1 sent to gauge
    /// @dev Only callable by the gauge contract
    function claimFees() external returns (uint256 _claimed0, uint256 _claimed1);

    /// @notice Error thrown when withdrawal amount exceeds available balance
    error WithdrawAmountTooBig();
    /// @notice Error thrown when a zero address is provided where a non-zero address is required
    error ZeroAddress();
    /// @notice Error thrown when caller is not the gauge
    error MsgSenderNotGauge();

    /// @notice Emitted when fees are claimed and distributed
    /// @param gauge The address of the gauge receiving fees
    /// @param token0Amount Amount of token0 distributed
    /// @param token1Amount Amount of token1 distributed
    event FeesDistributed(address indexed gauge, uint256 token0Amount, uint256 token1Amount);
    /// @notice Emitted when the NFT information is updated
    event UpdateTheNFTInfo();
}