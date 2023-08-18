

## Errors
## locked

```solidity
error locked()
```

Emitted by the reentrancy guard

## arithmeticError

```solidity
error arithmeticError()
```

Emitted if arithmetic error occurred

## alreadyInitialized

```solidity
error alreadyInitialized()
```

Emitted if an attempt is made to initialize the pool twice

## notInitialized

```solidity
error notInitialized()
```

Emitted if an attempt is made to mint or swap in uninitialized pool

## zeroAmountRequired

```solidity
error zeroAmountRequired()
```

Emitted if 0 is passed as amountRequired to swap function

## invalidAmountRequired

```solidity
error invalidAmountRequired()
```

Emitted if invalid amount is passed as amountRequired to swap function

## insufficientInputAmount

```solidity
error insufficientInputAmount()
```

Emitted if the pool received fewer tokens than it should have

## zeroLiquidityDesired

```solidity
error zeroLiquidityDesired()
```

Emitted if there was an attempt to mint zero liquidity

## zeroLiquidityActual

```solidity
error zeroLiquidityActual()
```

Emitted if actual amount of liquidity is zero (due to insufficient amount of tokens received)

## flashInsufficientPaid0

```solidity
error flashInsufficientPaid0()
```

Emitted if the pool received fewer tokens{0,1} after flash than it should have

## flashInsufficientPaid1

```solidity
error flashInsufficientPaid1()
```



## invalidLimitSqrtPrice

```solidity
error invalidLimitSqrtPrice()
```

Emitted if limitSqrtPrice param is incorrect

## tickIsNotSpaced

```solidity
error tickIsNotSpaced()
```

Tick must be divisible by tickspacing

## notAllowed

```solidity
error notAllowed()
```

Emitted if a method is called that is accessible only to the factory owner or dedicated role

## onlyFarming

```solidity
error onlyFarming()
```

Emitted if a method is called that is accessible only to the farming

## invalidNewTickSpacing

```solidity
error invalidNewTickSpacing()
```



## invalidNewCommunityFee

```solidity
error invalidNewCommunityFee()
```



## dynamicFeeActive

```solidity
error dynamicFeeActive()
```



## dynamicFeeDisabled

```solidity
error dynamicFeeDisabled()
```



## pluginIsNotConnected

```solidity
error pluginIsNotConnected()
```



## invalidHookResponse

```solidity
error invalidHookResponse(bytes4 selector)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| selector | bytes4 |  |

## liquiditySub

```solidity
error liquiditySub()
```

Emitted if liquidity underflows

## liquidityAdd

```solidity
error liquidityAdd()
```

Emitted if liquidity overflows

## topTickLowerOrEqBottomTick

```solidity
error topTickLowerOrEqBottomTick()
```



## bottomTickLowerThanMIN

```solidity
error bottomTickLowerThanMIN()
```



## topTickAboveMAX

```solidity
error topTickAboveMAX()
```



## liquidityOverflow

```solidity
error liquidityOverflow()
```



## tickIsNotInitialized

```solidity
error tickIsNotInitialized()
```



## tickInvalidLinks

```solidity
error tickInvalidLinks()
```



## transferFailed

```solidity
error transferFailed()
```



## tickOutOfRange

```solidity
error tickOutOfRange()
```



## priceOutOfRange

```solidity
error priceOutOfRange()
```



