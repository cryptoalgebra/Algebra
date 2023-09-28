

# IAlgebraPoolErrors


Errors emitted by a pool

Contains custom errors emitted by the pool

*Developer note: Custom errors are separated from the common pool interface for compatibility with older versions of Solidity*


## Errors
## locked

```solidity
error locked()
```
**Selector**: `0xcf309012`

Emitted by the reentrancy guard

## arithmeticError

```solidity
error arithmeticError()
```
**Selector**: `0x8995290f`

Emitted if arithmetic error occurred

## alreadyInitialized

```solidity
error alreadyInitialized()
```
**Selector**: `0x52669adc`

Emitted if an attempt is made to initialize the pool twice

## notInitialized

```solidity
error notInitialized()
```
**Selector**: `0x812eb655`

Emitted if an attempt is made to mint or swap in uninitialized pool

## zeroAmountRequired

```solidity
error zeroAmountRequired()
```
**Selector**: `0x79db9840`

Emitted if 0 is passed as amountRequired to swap function

## invalidAmountRequired

```solidity
error invalidAmountRequired()
```
**Selector**: `0x69967402`

Emitted if invalid amount is passed as amountRequired to swap function

## insufficientInputAmount

```solidity
error insufficientInputAmount()
```
**Selector**: `0xfb5b5414`

Emitted if the pool received fewer tokens than it should have

## zeroLiquidityDesired

```solidity
error zeroLiquidityDesired()
```
**Selector**: `0xe6ace6df`

Emitted if there was an attempt to mint zero liquidity

## zeroLiquidityActual

```solidity
error zeroLiquidityActual()
```
**Selector**: `0xbeba2a6c`

Emitted if actual amount of liquidity is zero (due to insufficient amount of tokens received)

## flashInsufficientPaid0

```solidity
error flashInsufficientPaid0()
```
**Selector**: `0x6dbca1fe`

Emitted if the pool received fewer tokens{0,1} after flash than it should have

## flashInsufficientPaid1

```solidity
error flashInsufficientPaid1()
```
**Selector**: `0xc998149f`



## invalidLimitSqrtPrice

```solidity
error invalidLimitSqrtPrice()
```
**Selector**: `0x16626723`

Emitted if limitSqrtPrice param is incorrect

## tickIsNotSpaced

```solidity
error tickIsNotSpaced()
```
**Selector**: `0x5f6e14f3`

Tick must be divisible by tickspacing

## notAllowed

```solidity
error notAllowed()
```
**Selector**: `0x932984d2`

Emitted if a method is called that is accessible only to the factory owner or dedicated role

## onlyFarming

```solidity
error onlyFarming()
```
**Selector**: `0xae74b178`

Emitted if a method is called that is accessible only to the farming

## invalidNewTickSpacing

```solidity
error invalidNewTickSpacing()
```
**Selector**: `0xafe09f44`



## invalidNewCommunityFee

```solidity
error invalidNewCommunityFee()
```
**Selector**: `0xa709b9af`



## dynamicFeeActive

```solidity
error dynamicFeeActive()
```
**Selector**: `0xd39b8e0e`



## dynamicFeeDisabled

```solidity
error dynamicFeeDisabled()
```
**Selector**: `0x3a4528ef`



## pluginIsNotConnected

```solidity
error pluginIsNotConnected()
```
**Selector**: `0x9e727ce3`



## invalidHookResponse

```solidity
error invalidHookResponse(bytes4 selector)
```
**Selector**: `0xd3f5153b`



| Name | Type | Description |
| ---- | ---- | ----------- |
| selector | bytes4 |  |

## liquiditySub

```solidity
error liquiditySub()
```
**Selector**: `0x1301f748`

Emitted if liquidity underflows

## liquidityAdd

```solidity
error liquidityAdd()
```
**Selector**: `0x997402f2`

Emitted if liquidity overflows

## topTickLowerOrEqBottomTick

```solidity
error topTickLowerOrEqBottomTick()
```
**Selector**: `0xd9a841a7`



## bottomTickLowerThanMIN

```solidity
error bottomTickLowerThanMIN()
```
**Selector**: `0x746b1fc4`



## topTickAboveMAX

```solidity
error topTickAboveMAX()
```
**Selector**: `0x1445443d`



## liquidityOverflow

```solidity
error liquidityOverflow()
```
**Selector**: `0x25b8364a`



## tickIsNotInitialized

```solidity
error tickIsNotInitialized()
```
**Selector**: `0x0d6e0949`



## tickInvalidLinks

```solidity
error tickInvalidLinks()
```
**Selector**: `0xe45ac17d`



## transferFailed

```solidity
error transferFailed()
```
**Selector**: `0xe465903e`



## tickOutOfRange

```solidity
error tickOutOfRange()
```
**Selector**: `0x3c10250f`



## priceOutOfRange

```solidity
error priceOutOfRange()
```
**Selector**: `0x55cf1e23`



