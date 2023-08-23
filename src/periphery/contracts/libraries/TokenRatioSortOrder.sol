// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library TokenRatioSortOrder {
    int256 internal constant NUMERATOR_MOST = 300;
    int256 internal constant NUMERATOR_MORE = 200;
    int256 internal constant NUMERATOR = 100;

    int256 internal constant DENOMINATOR_MOST = -300;
    int256 internal constant DENOMINATOR_MORE = -200;
    int256 internal constant DENOMINATOR = -100;
}
