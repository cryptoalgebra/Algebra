<p align="center">
  <a href="https://algebra.finance/"><img alt="Algebra" src="logo.svg" width="360"></a>
</p>

<p align="center">
Innovative DEX with concentrated liquidity, adaptive fee, built-in farming etc.
</p>
 
 <p align="center">
 <a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests.yml"><img alt="Tests status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests.yml/badge.svg"></a>
  <a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna.yml/badge.svg"></a>
</p>


- [Build](#Build)
- [Tests](#Tests)
- [Coverage](#Tests-coverage)
- [Deploy](#Deploy)


## Build

*Requires npm >= 8.0.0*

To install dependencies, you need to run the command in the root directory:
```
$ npm run bootstrap
```
This will download and install dependencies for all modules and set up husky hooks.



To compile a specific module, you need to run the following command in the module folder:
```
$ npm run compile
```


## Tests

Tests for a specific module are run by the following command in the module folder:
```
$ npm run test
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
