module.exports = {
  skipFiles: [
    'AlgebraTokenStaking.sol',
    'AlgebraVault.sol',
    'test/TestERC20.sol',
    'test/TestERC20Reentrant.sol',
    'test/TestIncentiveId.sol',
    'test/TestRewardMath.sol',
    'test/PoolMock.sol',
    'test/NftPosManagerMock.sol',
    'base/ERC20.sol',
    'base/FreezableToken.sol',
    'base/PeripheryPayments.sol',
  ],
  mocha: {
    grep: '@skip-on-coverage', // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
}
