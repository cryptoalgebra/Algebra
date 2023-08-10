// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

contract MockObservable {
    Timepoint private timepoint0;
    Timepoint private timepoint1;

    struct Timepoint {
        uint32 secondsAgo;
        int56 tickCumulatives;
        uint112 volatilityCumulative;
    }

    constructor(uint32[] memory secondsAgos, int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
        require(
            secondsAgos.length == 2 && tickCumulatives.length == 2 && volatilityCumulatives.length == 2,
            'Invalid test case size'
        );

        timepoint0 = Timepoint(secondsAgos[0], tickCumulatives[0], volatilityCumulatives[0]);
        timepoint1 = Timepoint(secondsAgos[1], tickCumulatives[1], volatilityCumulatives[1]);
    }

    function getTimepoints(
        uint32[] calldata secondsAgos
    ) external view returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
        require(
            secondsAgos[0] == timepoint0.secondsAgo && secondsAgos[1] == timepoint1.secondsAgo,
            'Invalid test case'
        );

        int56[] memory _tickCumulatives = new int56[](2);
        _tickCumulatives[0] = timepoint0.tickCumulatives;
        _tickCumulatives[1] = timepoint1.tickCumulatives;

        uint112[] memory _volatilityCumulatives = new uint112[](2);
        _volatilityCumulatives[0] = timepoint0.volatilityCumulative;
        _volatilityCumulatives[1] = timepoint1.volatilityCumulative;

        return (_tickCumulatives, _volatilityCumulatives);
    }

    function plugin() external view returns (address) {
        return address(this);
    }
}
