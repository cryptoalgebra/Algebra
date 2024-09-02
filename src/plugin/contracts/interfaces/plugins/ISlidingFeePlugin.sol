// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface ISlidingFeePlugin {
  event PriceChangeFactor(uint256 priceChangeFactor);
  event BaseFee(uint16 baseFee);

  function setBaseFee(uint16 newBaseFee) external;

  function setPriceChangeFactor(uint16 newPriceChangeFactor) external;
}
