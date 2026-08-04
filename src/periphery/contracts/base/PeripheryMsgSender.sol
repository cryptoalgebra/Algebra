// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '../interfaces/IMsgSender.sol';

/// @title Periphery msg sender reporting
/// @notice Lets permissioned-pool plugins resolve the real end-user behind a router call
/// @dev A permissioned pool only ever sees the router itself as the caller of `swap`/`mint`, since a plain EOA
/// can never call those directly (they require the caller to implement the matching Algebra callback). The
/// `reportSender` modifier records the real caller for the duration of the outer call, so that a pool plugin
/// calling back into this contract mid-transaction (via `msgSender()`) can recover it.
abstract contract PeripheryMsgSender is IMsgSender {
    /// @dev The real caller of the entry point currently executing, or zero if none is in progress
    address private _msgSenderOverride;

    /// @dev Records `msg.sender` for the duration of the call so it can be reported back to a permissioned
    /// pool plugin via `msgSender()`. Must only be applied to external entry points, never to functions
    /// reachable only via another entry point already carrying this modifier, since it is not reentrant-safe.
    modifier reportSender() {
        _msgSenderOverride = msg.sender;
        _;
        _msgSenderOverride = address(0);
    }

    /// @inheritdoc IMsgSender
    function msgSender() external view override returns (address) {
        return _msgSenderOverride;
    }
}
