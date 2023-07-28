// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './pool/IAlgebraPoolImmutables.sol';
import './pool/IAlgebraPoolState.sol';
import './pool/IAlgebraPoolActions.sol';
import './pool/IAlgebraPoolPermissionedActions.sol';
import './pool/IAlgebraPoolEvents.sol';

/// @title The legacy interface for a Algebra Pool
/// @dev The pool interface is broken up into many smaller pieces.
/// This interface does not include custom error definitions and can be used in older versions of Solidity.
/// Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraPoolLegacy is IAlgebraPoolImmutables, IAlgebraPoolState, IAlgebraPoolActions, IAlgebraPoolPermissionedActions, IAlgebraPoolEvents {
  // used only for combining interfaces
}
