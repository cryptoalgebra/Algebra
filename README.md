<p align="center">
  <a href="https://algebra.finance/"><img alt="Algebra" src="logo.svg" width="360"></a>
</p>

<p align="center">
Innovative DEX with concentrated liquidity and customizable plugins.
</p>
 
<p align="center">
<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests_core.yml"><img alt="Tests status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests_core.yml/badge.svg"></a>
<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests_periphery.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests_periphery.yml/badge.svg"></a>
<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests_farmings.yml"><img alt="Tests status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/tests_farmings.yml/badge.svg"></a>
</p>
<p align="center">
<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_core.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_core.yml/badge.svg"></a>
<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_periphery.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_periphery.yml/badge.svg"></a>
<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_farming.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_farming.yml/badge.svg"></a>
</p>


- [Docs](#docs)
- [Versions](#versions)
- [Packages](#packages)
- [Build](#build)
- [Tests](#tests)
- [Tests coverage](#tests-coverage)
- [Deploy](#deploy)

## Docs

The documentation page is located at: [https://docs.algebra.finance/](https://docs.algebra.finance/)

## Versions

Please note that different DEX-partners of our protocol may use different versions of the protocol. This repo contains the latest version: **Algebra Integral**. 

A page describing the versions used by partners can be found in the documentation: [partners page](https://docs.algebra.finance/algebra-integral-documentation/overview/partners-and-ecosystem)

Previous versions of the protocol have been moved to separate repositories:

[Algebra V1.9](https://github.com/cryptoalgebra/AlgebraV1.9)

[Algebra V1](https://github.com/cryptoalgebra/AlgebraV1)

## License

Algebra and Algebra Integral smart-contracts is licensed under the Business Source License 1.1 [(BUSL-1.1)](https://github.com/cryptoalgebra/Algebra/blob/integral-v1.2.2/src/core/LICENSE) and the MIT License (MIT). Licenses for smart contracts are specified in SPDX headers.

## Packages

Core: [https://www.npmjs.com/package/@cryptoalgebra/integral-core](https://www.npmjs.com/package/@cryptoalgebra/integral-core)

Periphery: [https://www.npmjs.com/package/@cryptoalgebra/integral-periphery](https://www.npmjs.com/package/@cryptoalgebra/integral-periphery)

Farming: [https://www.npmjs.com/package/@cryptoalgebra/integral-farming](https://www.npmjs.com/package/@cryptoalgebra/integral-farming)

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
