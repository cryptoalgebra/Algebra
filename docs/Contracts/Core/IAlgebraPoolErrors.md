

## Errors
## locked


`error locked()`  

Emitted by the reentrancy guard





## arithmeticError


`error arithmeticError()`  

Emitted if arithmetic error occurred





## alreadyInitialized


`error alreadyInitialized()`  

Emitted if an attempt is made to initialize the pool twice





## zeroAmountRequired


`error zeroAmountRequired()`  

Emitted if 0 is passed as amountRequired to swap function





## invalidAmountRequired


`error invalidAmountRequired()`  

Emitted if invalid amount is passed as amountRequired to swapSupportingFeeOnInputTokens function





## insufficientInputAmount


`error insufficientInputAmount()`  

Emitted if the pool received fewer tokens than it should have





## insufficientAmountReceivedAtMint


`error insufficientAmountReceivedAtMint()`  

Emitted if the pool received fewer tokens than it should have to mint calculated actual liquidity





## zeroLiquidityDesired


`error zeroLiquidityDesired()`  

Emitted if there was an attempt to mint zero liquidity





## zeroLiquidityActual


`error zeroLiquidityActual()`  

Emitted if actual amount of liquidity is zero (due to insufficient amount of tokens received)





## flashInsufficientPaid0


`error flashInsufficientPaid0()`  

Emitted if the pool received fewer tokens{0,1} after flash than it should have





## flashInsufficientPaid1


`error flashInsufficientPaid1()`  







## invalidLimitSqrtPrice


`error invalidLimitSqrtPrice()`  

Emitted if limitSqrtPrice param is incorrect





## tickIsNotSpaced


`error tickIsNotSpaced()`  

Tick must be divisible by tickspacing





## notAllowed


`error notAllowed()`  

Emitted if a method is called that is accessible only to the factory owner or dedicated role





## onlyFarming


`error onlyFarming()`  

Emitted if a method is called that is accessible only to the farming





## invalidNewTickSpacing


`error invalidNewTickSpacing()`  







## invalidNewCommunityFee


`error invalidNewCommunityFee()`  







## invalidTickForLimitOrder


`error invalidTickForLimitOrder()`  

Emitted if tick is too low/high for limit order





## invalidAmountForLimitOrder


`error invalidAmountForLimitOrder()`  

Emitted if amount is too high for limit order





## liquiditySub


`error liquiditySub()`  

Emitted if liquidity underflows





## liquidityAdd


`error liquidityAdd()`  

Emitted if liquidity overflows





## topTickLowerThanBottomTick


`error topTickLowerThanBottomTick()`  







## bottomTickLowerThanMIN


`error bottomTickLowerThanMIN()`  







## topTickAboveMAX


`error topTickAboveMAX()`  







## liquidityOverflow


`error liquidityOverflow()`  







## tickIsNotInitialized


`error tickIsNotInitialized()`  







## tickInvalidLinks


`error tickInvalidLinks()`  







## transferFailed


`error transferFailed()`  







## tickOutOfRange


`error tickOutOfRange()`  







## priceOutOfRange


`error priceOutOfRange()`  







