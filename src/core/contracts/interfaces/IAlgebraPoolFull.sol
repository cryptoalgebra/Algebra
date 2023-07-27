// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import './pool/IAlgebraPoolErrors.sol';
import './IAlgebraPool.sol';

/// @title The full interface for a Algebra Pool
/// @dev The pool interface is broken up into many smaller pieces.
/// This interface includes custom error definitions and cannot be used in older versions of Solidity
interface IAlgebraPoolFull is IAlgebraPool, IAlgebraPoolErrors {
  // used only for combining interfaces
}
