// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

contract MockOraclePlugin {
    function getTimepoints(
        uint32[] calldata
    ) external pure returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) {
        int56[] memory _tickCumulatives = new int56[](2);
        uint88[] memory _volatilityCumulatives = new uint88[](2);

        _tickCumulatives[0] = 0;
        _volatilityCumulatives[0] = 0;

        _tickCumulatives[1] = 10 * 15768000;
        _volatilityCumulatives[1] = 0;

        return (_tickCumulatives, _volatilityCumulatives);
    }
}
