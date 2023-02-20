// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IERC20Minimal.sol';

contract AlgebraCommunityVault {
  event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);

  address private immutable factory;

  modifier onlyOwner() {
    require(msg.sender == IAlgebraFactory(factory).owner());
    _;
  }

  constructor() {
    factory = msg.sender;
  }

  function withdraw(address token, address to, uint256 amount) external onlyOwner {
    _withdraw(token, to, amount);
  }

  function withdrawTokens(address[] calldata tokens, address[] calldata tos, uint256[] calldata amounts) external onlyOwner {
    uint256 tokensLength = tokens.length;
    require(tokensLength == tos.length && tokens.length == amounts.length);

    unchecked {
      for (uint256 i; i < tokensLength; ++i) {
        _withdraw(tokens[i], tos[i], amounts[i]);
      }
    }
  }

  function _withdraw(address token, address to, uint256 amount) private {
    IERC20Minimal(token).transfer(to, amount);
    emit TokensWithdrawn(token, to, amount);
  }
}
