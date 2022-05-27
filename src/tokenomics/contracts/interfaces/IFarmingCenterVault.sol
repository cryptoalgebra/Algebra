// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.7.6;

interface IFarmingCenterVault {
    function claimTokens(
        address token,
        address to,
        uint256 amount
    ) external;
}
