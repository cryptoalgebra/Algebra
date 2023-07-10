

<a href="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_core.yml"><img alt="Echidna status" src="https://github.com/cryptoalgebra/Algebra/actions/workflows/echidna_core.yml/badge.svg"></a>

This directory contains smart contracts that are used to run fuzzy tests using [Echidna](https://github.com/crytic/echidna). 

Most tests are done in assertion mode. However, the `PoolMockEchidna` directory contains the pool's integration tests, which are mostly run in property-based mode.
