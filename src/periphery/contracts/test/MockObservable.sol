// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

contract MockObservable {
    Timepoint private timepoint0;
    Timepoint private timepoint1;

    struct Timepoint {
        uint32 secondsAgo;
        int56 tickCumulatives;
        uint160 secondsPerLiquidityCumulativeX128s;
        uint112 volatilityCumulative;
        uint256 volumeGMCumulative;
    }

    constructor(
        uint32[] memory secondsAgos,
        int56[] memory tickCumulatives,
        uint160[] memory secondsPerLiquidityCumulativeX128s,
        uint112[] memory volatilityCumulatives,
        uint256[] memory volumeGMCumulatives
    ) {
        require(
            secondsAgos.length == 2 &&
                tickCumulatives.length == 2 &&
                secondsPerLiquidityCumulativeX128s.length == 2 &&
                volatilityCumulatives.length == 2 &&
                volumeGMCumulatives.length == 2,
            'Invalid test case size'
        );

        timepoint0 = Timepoint(
            secondsAgos[0],
            tickCumulatives[0],
            secondsPerLiquidityCumulativeX128s[0],
            volatilityCumulatives[0],
            volumeGMCumulatives[0]
        );
        timepoint1 = Timepoint(
            secondsAgos[1],
            tickCumulatives[1],
            secondsPerLiquidityCumulativeX128s[1],
            volatilityCumulatives[1],
            volumeGMCumulatives[1]
        );
    }

    function getTimepoints(uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s,
            uint112[] memory volatilityCumulatives,
            uint256[] memory volumeGMCumulatives
        )
    {
        require(
            secondsAgos[0] == timepoint0.secondsAgo && secondsAgos[1] == timepoint1.secondsAgo,
            'Invalid test case'
        );

        int56[] memory _tickCumulatives = new int56[](2);
        _tickCumulatives[0] = timepoint0.tickCumulatives;
        _tickCumulatives[1] = timepoint1.tickCumulatives;

        uint160[] memory _secondsPerLiquidityCumulativeX128s = new uint160[](2);
        _secondsPerLiquidityCumulativeX128s[0] = timepoint0.secondsPerLiquidityCumulativeX128s;
        _secondsPerLiquidityCumulativeX128s[1] = timepoint1.secondsPerLiquidityCumulativeX128s;

        uint112[] memory _volatilityCumulatives = new uint112[](2);
        _volatilityCumulatives[0] = timepoint0.volatilityCumulative;
        _volatilityCumulatives[1] = timepoint1.volatilityCumulative;

        uint256[] memory _volumeGMCumulatives = new uint256[](2);
        _volumeGMCumulatives[0] = timepoint0.volumeGMCumulative;
        _volumeGMCumulatives[1] = timepoint1.volumeGMCumulative;

        return (_tickCumulatives, _secondsPerLiquidityCumulativeX128s, _volatilityCumulatives, _volumeGMCumulatives);
    }

    function dataStorageOperator() external view returns (address) {
        return address(this);
    }
}
