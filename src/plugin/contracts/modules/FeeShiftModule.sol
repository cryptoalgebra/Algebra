// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AlgebraBaseModule} from '../base/AlgebraBaseModule.sol';

import {IAlgebraPool} from "@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol";

import {ModuleUtils} from '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/libraries/ModuleUtils.sol';
import {AlgebraModule} from '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/base/AlgebraModule.sol';
import {BeforeSwapParams} from '@cryptoalgebra/algebra-modular-hub-v0.8.20/contracts/types/HookParams.sol';

import 'hardhat/console.sol';

contract FeeShiftModule is AlgebraBaseModule {
    struct PriceSnapshot {
        uint32 lastBlockNumber;
        uint160 lastPrice;
    }

    struct FeeFactors {
        uint128 zeroToOneFeeFactor;
        uint128 oneToZeroFeeFactor;
    }

    uint64 internal constant FEE_FACTOR_SHIFT = 64;

    FeeFactors public s_feeFactors;

    uint256 public s_priceChangeFactor = 1;

    PriceSnapshot internal s_priceSnapshot;

    constructor(address _modularHub) AlgebraModule(_modularHub) {
        FeeFactors memory feeFactors = FeeFactors(
            uint128(1 << FEE_FACTOR_SHIFT),
            uint128(1 << FEE_FACTOR_SHIFT)
        );

        s_feeFactors = feeFactors;
    }

    function _beforeSwap(
        bytes memory params,
        uint16 poolFeeCache
    ) internal virtual override {
        console.log(3);
        // TODO: set pool address in init (when module is connected)
        BeforeSwapParams memory decodedParams = abi.decode(params, (BeforeSwapParams));


        PriceSnapshot memory priceSnapshot = s_priceSnapshot;
        FeeFactors memory currentFeeFactors;

        if (priceSnapshot.lastBlockNumber != block.number) {
            uint256 lastPrice = priceSnapshot.lastPrice;

            (uint256 currentPrice, , , , ,) = IAlgebraPool(pool).globalState();

            s_priceSnapshot = PriceSnapshot(
                uint32(block.number),
                uint160(currentPrice)
            );

            if (lastPrice == 0) {
                ModuleUtils.returnDynamicFeeResult(poolFeeCache, false);
            }

            currentFeeFactors = _calculateFeeFactors(int256(currentPrice), int256(lastPrice));

            s_feeFactors = currentFeeFactors;
        } else {
            currentFeeFactors = s_feeFactors;
        }

        console.log(4);

        uint16 adjustedFee = decodedParams.zeroToOne ?
            uint16((poolFeeCache * currentFeeFactors.zeroToOneFeeFactor) >> FEE_FACTOR_SHIFT) :
            uint16((poolFeeCache * currentFeeFactors.oneToZeroFeeFactor) >> FEE_FACTOR_SHIFT);

        ModuleUtils.returnDynamicFeeResult(adjustedFee, false);
    }

    function _calculateFeeFactors(
        int256 currentPrice,
        int256 lastPrice
    ) internal view returns (FeeFactors memory feeFactors) {
        console.log('lastPrice: ', uint256(lastPrice));
        console.log('currentPrice: ', uint256(currentPrice));
        // price change is positive after zeroToOne prevalence
        int256 priceChange = currentPrice - lastPrice;
        int128 feeFactorImpact = int128((priceChange * 2 << FEE_FACTOR_SHIFT) / lastPrice); // TODO: add coefficient

        feeFactors = s_feeFactors;

        // if there were zeroToOne prevalence in the last price change,
        // in result price has increased
        // we need to increase zeroToOneFeeFactor
        // and vice versa
        int128 newZeroToOneFeeFactor = int128(feeFactors.zeroToOneFeeFactor) + feeFactorImpact;
        console.logInt(newZeroToOneFeeFactor);

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
