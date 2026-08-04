// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title IMsgSender
/// @notice Trusted self-reporting interface that routers must implement so that
/// permissioned-pool checks can resolve the real end-user instead of trusting `tx.origin`
/// or the raw hook `sender` (which is only ever the immediate caller of the pool, e.g. a router).
/// @dev A contract's `msgSender()` report is only trusted by a permissioned pool's plugin
/// if that contract is separately registered as an allowed router on that pool's own plugin
interface IMsgSender {
    /// @notice Returns the address this router considers to be the real initiator of the current call
    /// @return The real end-user address, as reported by the router itself
    function msgSender() external view returns (address);
}
