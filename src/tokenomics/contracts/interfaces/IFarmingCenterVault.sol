// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.7.6;

interface IFarmingCenterVault {
    function claimTokens(
        address token,
        address to,
        uint256 tokenId,
        bytes32 incentiveId
    ) external;

    function setFarmingCenter(address farming) external;

    function lockTokens(
        uint256 tokenId,
        bytes32 incentiveId,
        uint256 tokenAmount
    ) external;

    function balances(uint256 tokenId, bytes32 incentiveId) external view returns (uint256 balance);
}
