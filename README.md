# Algebra 
Innovative DEX with concentrated liquidity, adaptive fee, build-in farming etc.

 
[![Tests](https://github.com/cryptoalgebra/Algebra/actions/workflows/tests.yml/badge.svg)](https://github.com/cryptoalgebra/Algebra/actions/workflows/tests.yml)

## Build

To install dependencies, you need to run the command in the root directory:
```
$ npm run bootstrap
```
This will download and install dependencies for all modules and set up husky hooks.



To compile a specific module, you need to run the following command in the module folder:
```
$ npm run compile
```
Or:
```
$ hardhat compile
```


## Tests

Tests for a specific module are run by the following command in the module folder:
```
$ npm run test
```
Or:
```
$ hardhat test
```

## Tests coverage

To get a test coverage for specific module, you need to run the following command in the module folder:

```
$ npm run coverage
```

## Deploy
Firstly you need to create `.env` file in the root directory of project as in `env.example`.

To deploy all modules in specific network:
```
$ node scripts/deployAll.js <network>
```
