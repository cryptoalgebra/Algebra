// SPDX-License-Identifier: MIT
pragma solidity =0.8.20;

import {IAlgebraPool} from '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import {Timestamp} from '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';

abstract contract SlidingFeeModule is Timestamp {
    struct FeeFactors {
        uint128 zeroToOneFeeFactor;
        uint128 oneToZeroFeeFactor;
    }

    uint64 internal constant FEE_FACTOR_SHIFT = 64;

    FeeFactors public s_feeFactors;

    uint256 public s_priceChangeFactor = 1;

    event PriceChangeFactor(uint256 priceChangeFactor);

    constructor() {
        FeeFactors memory feeFactors = FeeFactors(
            uint128(1 << FEE_FACTOR_SHIFT),
            uint128(1 << FEE_FACTOR_SHIFT)
        );

        s_feeFactors = feeFactors;
    }

    function _getFeeAndUpdateFactors(
        uint256 currentPrice,
        uint256 lastPrice,
        uint16 poolFee,
        bool zeroToOne
    ) internal returns (uint16) {
        FeeFactors memory currentFeeFactors;

        if (lastPrice == 0) {
            return poolFee;
        }

        currentFeeFactors = _calculateFeeFactors(int256(currentPrice), int256(lastPrice));

        s_feeFactors = currentFeeFactors;

        uint16 adjustedFee = zeroToOne ?
            uint16((poolFee * currentFeeFactors.zeroToOneFeeFactor) >> FEE_FACTOR_SHIFT) :
            uint16((poolFee * currentFeeFactors.oneToZeroFeeFactor) >> FEE_FACTOR_SHIFT);

        return adjustedFee;
    }

    function _calculateFeeFactors(
        int256 currentPrice,
        int256 lastPrice
    ) internal view returns (FeeFactors memory feeFactors) {
        // price change is positive after zeroToOne prevalence
        int256 priceChange = currentPrice - lastPrice;
        int128 feeFactorImpact = int128((priceChange * int256(s_priceChangeFactor) << FEE_FACTOR_SHIFT) / lastPrice);

        feeFactors = s_feeFactors;

        // if there were zeroToOne prevalence in the last price change,
        // in result price has increased
        // we need to increase zeroToOneFeeFactor
        // and vice versa
        int128 newZeroToOneFeeFactor = int128(feeFactors.zeroToOneFeeFactor) + feeFactorImpact;

        if ((int128(-2) << FEE_FACTOR_SHIFT) < newZeroToOneFeeFactor && newZeroToOneFeeFactor < int128(uint128(2) << FEE_FACTOR_SHIFT)) {
            feeFactors = FeeFactors(
                uint128(newZeroToOneFeeFactor),
                uint128(int128(feeFactors.oneToZeroFeeFactor) - feeFactorImpact)
            );
        } else if (newZeroToOneFeeFactor <= 0) {
            // In this case price has decreased that much so newZeroToOneFeeFactor is less than 0
            // So we set it to the minimal value == 0
            // It means that there were too much oneToZero prevalence and we want to decrease it
            // Basically price change is -100%
            feeFactors = FeeFactors(
                uint128(2 << FEE_FACTOR_SHIFT),
                0
            );
        } else {
            // In this case priceChange is big enough that newZeroToOneFeeFactor is greater than 2
            // So we set it to the maximum value
            // It means that there were too much zeroToOne prevalence and we want to decrease it
            feeFactors = FeeFactors(
                0,
                uint128(2 << FEE_FACTOR_SHIFT)
            );
        }
    }
}