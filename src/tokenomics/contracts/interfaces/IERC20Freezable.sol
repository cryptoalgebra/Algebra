// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/**
 * @title Minimal ERC20 interface for Algebra
 * @notice Contains a subset of the full ERC20 interface that is used in Algebra
 */
interface IERC20Minimal {
    /**
     * @notice Returns the balance of a token
     * @param account The account for which to look up the number of tokens it has, i.e. its balance
     * @return The number of tokens held by the account
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @notice Transfers the amount of token from the `msg.sender` to the recipient
     * @param recipient The account that will receive the amount transferred
     * @param amount The number of tokens to send from the sender to the recipient
     * @return Returns true for a successful transfer, false for an unsuccessful transfer
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @notice Returns the current allowance given to a spender by an owner
     * @param owner The account of the token owner
     * @param spender The account of the token spender
     * @return The current allowance granted by `owner` to `spender`
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @notice Sets the allowance of a spender from the `msg.sender` to the value `amount`
     * @param spender The account which will be allowed to spend a given amount of the owners tokens
     * @param amount The amount of tokens allowed to be used by `spender`
     * @return Returns true for a successful approval, false for unsuccessful
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @notice Transfers `amount` tokens from `sender` to `recipient` up to the allowance given to the `msg.sender`
     * @param sender The account from which the transfer will be initiated
     * @param recipient The recipient of the transfer
     * @param amount The amount of the transfer
     * @return Returns true for a successful transfer, false for unsuccessful
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /**
     * @dev Mint the specified amount of token to the specified address and freeze it until the specified date.
     *     Be careful, gas usage is not deterministic,
     *     and depends on how many freezes _to address already has.
     * @param _to Address to which token will be freeze.
     * @param _amount Amount of token to mint and freeze.
     * @param _until Release date, must be in future.
     * @return A boolean that indicates if the operation was successful.
     */
    function mintAndFreeze(
        address _to,
        uint256 _amount,
        uint64 _until
    ) external returns (bool);

    /**
     * @dev release first available freezing tokens.
     */
    function releaseOnce() external;

    /**
     * @dev gets freezing end date and freezing balance for the freezing portion specified by index.
     * @param _addr Address of freeze tokens owner.
     * @param _index Freezing portion index. It ordered by release date descending.
     */
    function getFreezing(address _addr, uint256 _index) external view returns (uint64 _release, uint256 _balance);

    /**
     * @notice Event emitted when tokens are transferred from one address to another, either via `#transfer` or `#transferFrom`.
     * @param from The account from which the tokens were sent, i.e. the balance decreased
     * @param to The account to which the tokens were sent, i.e. the balance increased
     * @param value The amount of tokens that were transferred
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @notice Event emitted when the approval amount for the spender of a given owner's tokens changes.
     * @param owner The account that approved spending of its tokens
     * @param spender The account for which the spending allowance was modified
     * @param value The new allowance from the owner to the spender
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
