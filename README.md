# ✨ So you want to sponsor a contest

This `README.md` contains a set of checklists for our contest collaboration.

Your contest will use two repos: 
- **a _contest_ repo** (this one), which is used for scoping your contest and for providing information to contestants (wardens)
- **a _findings_ repo**, where issues are submitted (shared with you after the contest) 

Ultimately, when we launch the contest, this contest repo will be made public and will contain the smart contracts to be reviewed and all the information needed for contest participants. The findings repo will be made public after the contest report is published and your team has mitigated the identified issues.

Some of the checklists in this doc are for **C4 (🐺)** and some of them are for **you as the contest sponsor (⭐️)**.

---

# Contest setup

## ⭐️ Sponsor: Provide contest details

Under "SPONSORS ADD INFO HERE" heading below, include the following:

- [ ] Create a PR to this repo with the below changes:
- [ ] Name of each contract and:
  - [ ] source lines of code (excluding blank lines and comments) in each
  - [ ] external contracts called in each
  - [ ] libraries used in each
- [ ] Describe any novel or unique curve logic or mathematical models implemented in the contracts
- [ ] Does the token conform to the ERC-20 standard? In what specific ways does it differ?
- [ ] Describe anything else that adds any special logic that makes your approach unique
- [ ] Identify any areas of specific concern in reviewing the code
- [ ] Add all of the code to this repo that you want reviewed


---

# Contest prep

## ⭐️ Sponsor: Contest prep
- [ ] Provide a self-contained repository with working commands that will build (at least) all in-scope contracts, and commands that will run tests producing gas reports for the relevant contracts.
- [ ] Make sure your code is thoroughly commented using the [NatSpec format](https://docs.soliditylang.org/en/v0.5.10/natspec-format.html#natspec-format).
- [ ] Modify the bottom of this `README.md` file to describe how your code is supposed to work with links to any relevent documentation and any other criteria/details that the C4 Wardens should keep in mind when reviewing. ([Here's a well-constructed example.](https://github.com/code-423n4/2021-06-gro/blob/main/README.md))
- [ ] Please have final versions of contracts and documentation added/updated in this repo **no less than 24 hours prior to contest start time.**
- [ ] Be prepared for a 🚨code freeze🚨 for the duration of the contest — important because it establishes a level playing field. We want to ensure everyone's looking at the same code, no matter when they look during the contest. (Note: this includes your own repo, since a PR can leak alpha to our wardens!)
- [ ] Promote the contest on Twitter (optional: tag in relevant protocols, etc.)
- [ ] Share it with your own communities (blog, Discord, Telegram, email newsletters, etc.)
- [ ] Optional: pre-record a high-level overview of your protocol (not just specific smart contract functions). This saves wardens a lot of time wading through documentation.
- [ ] Delete this checklist and all text above the line below when you're ready.

---

# QuickSwap contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-09-quickswap-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 26, 2022 20:00 UTC
- Ends October 01, 2022 20:00 UTC

[ ⭐️ SPONSORS ADD INFO HERE ]

<p align="center">
  <a href="https://algebra.finance/"><img alt="Algebra" src="logo.svg" width="360"></a>
</p>

<p align="center">
Innovative DEX with concentrated liquidity, adaptive fee, build-in farming etc.
</p>

## Building and Testing
 
- [Build](#Build)
- [Tests](#Tests)
- [Coverage](#Tests-coverage)
- [Deploy](#Deploy)


### Build

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


### Tests

Tests for a specific module are run by the following command in the module folder:
```
$ npm run test
```

### Tests coverage

To get a test coverage for specific module, you need to run the following command in the module folder:

```
$ npm run coverage
```

### Deploy
Firstly you need to create `.env` file in the root directory of project as in `env.example`.

To deploy all modules in specific network:
```
$ node scripts/deployAll.js <network>
```

## Links

- **Docs** : https://docs.algebra.finance/docs/intro
- **Tech Paper** : https://algebra.finance/static/Algerbra%20Tech%20Paper-15411d15f8653a81d5f7f574bfe655ad.pdf


## Scope
|File|SLOC|Coverage|
|:-|:-:|:-:|
|_Contracts (12)_|
|[src/core/contracts/AlgebraFactory.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/AlgebraFactory.sol)|83|100%|
|[src/core/contracts/AlgebraPool.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/AlgebraPool.sol)|789|100%|
|[src/core/contracts/AlgebraPoolDeployer.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/AlgebraPoolDeployer.sol)|40|100%|
|[src/core/contracts/DataStorageOperator.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/DataStorageOperator.sol)|127|96.55%|
|[src/core/contracts/libraries/AdaptiveFee.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/AdaptiveFee.soll)|74|97.37%|
|[src/core/contracts/libraries/DataStorage.sol.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/DataStorage.sol.soll)|271|94.29%|
|[src/core/contracts/libraries/LiquidityMath.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/LiquidityMath.sol)|10|100%|
|[src/core/contracts/libraries/PriceMovementMath.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/PriceMovementMath.sol)|143|98.11%|
|[src/core/contracts/libraries/TickManager.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/TickManager.sol)|95|100%|
|[src/core/contracts/libraries/TickMath.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/TickMath.sol)|169|100%|
|[src/core/contracts/libraries/TickTable.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/TickTable.sol)|94|100%|
|[src/core/contracts/libraries/TokenDeltaMath.sol.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/libraries/TokenDeltaMath.sol.sol)|50|100%|
|_Abstracts (2)_|
|[src/core/contracts/base/src/PoolImmutables.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/base/src/PoolImmutables.sol)|19|[src/core/contracts/base/src/PoolState.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/contracts/base/src/PoolState.sol)|32|-|
|Total (over 14 files):|1996|98.86%|

### 