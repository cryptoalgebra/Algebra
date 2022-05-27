pragma solidity 0.7.6;

interface IFarmingCenterVault {
    function claimTokens(
        address token,
        address to,
        uint256 amount
    ) external;
}
