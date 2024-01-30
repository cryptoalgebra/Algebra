// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v2;

import '../base/Multicall.sol';

contract TestMulticall is Multicall {
    error CustomError();

    function functionThatRevertsWithError(string memory error) external pure {
        revert(error);
    }

    function functionThatRevertsSilently() external pure {
        revert();
    }

    function functionThatRevertsWithCustomError() external pure {
        revert CustomError();
    }

    function functionThatRevertsWithPanic() external pure returns (uint256) {
        uint256 a = 5;
        return a - 10;
    }

    struct Tuple {
        uint256 a;
        uint256 b;
    }

    function functionThatReturnsTuple(uint256 a, uint256 b) external pure returns (Tuple memory tuple) {
        tuple = Tuple({b: a, a: b});
    }

    uint256 public paid;

    function pays() external payable {
        paid += msg.value;
    }

    function returnSender() external view returns (address) {
        return msg.sender;
    }
}
