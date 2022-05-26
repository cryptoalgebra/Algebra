// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IAlgebraVirtualPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/IMulticall.sol';
import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

import 'algebra-periphery/contracts/interfaces/IPeripheryPayments.sol';

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

import '../incentiveFarming/interfaces/IAlgebraIncentiveFarming.sol';
import '../eternalFarming/interfaces/IAlgebraEternalFarming.sol';
import './IFarmingCenterVault.sol';
import './IIncentiveKey.sol';

interface IFarmingCenter is
    IAlgebraVirtualPool,
    IERC721Receiver,
    IIncentiveKey,
    IMulticall,
    IERC721Permit,
    IPeripheryPayments
{
    struct VirtualPoolAddresses {
        bool hasIncentive;
        uint32 incentiveNonce;
        address eternalVirtualPool;
        address virtualPool;
    }

    function virtualPoolAddresses(address) external view returns (address, address);

    /// @notice The nonfungible position manager with which this farming contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    function farming() external view returns (IAlgebraIncentiveFarming);

    function eternalFarming() external view returns (IAlgebraEternalFarming);

    function farmingCenterVault() external view returns (IFarmingCenterVault);

    function l2Nfts(uint256)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            uint256 tokenId
        );

    /// @notice Returns information about a deposited NFT
    /// @return L2TokenId The nft layer2 id
    /// @return tickLower The lower tick of the range
    /// @return tickUpper The upper tick of the range
    /// @return numberOfFarms
    /// @return owner
    /// @return inLimitFarming 
    /// @return tokensLocked
    function deposits(uint256 tokenId)
        external
        view
        returns (
            uint256 L2TokenId,
            int24 tickLower,
            int24 tickUpper,
            uint32 numberOfFarms,
            address owner,
            bool inLimitFarming,
            uint256 tokensLocked
        );

    function setFarmingCenterAddress(IAlgebraPool pool, address virtualPool) external;

    function enterEternalFarming(IncentiveKey memory key, uint256 tokenId,uint256 tokensLocked) external;

    function exitEternalFarming(IncentiveKey memory key, uint256 tokenId) external;

    function collect(INonfungiblePositionManager.CollectParams calldata params)
        external
        returns (uint256 amount0, uint256 amount1);

    function collectRewards(IncentiveKey memory key, uint256 tokenId)
        external
        returns (uint256 reward, uint256 bonusReward);

    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequestedIncentive,
        uint256 amountRequestedEternal
    ) external returns (uint256 reward);

    function enterFarming(IncentiveKey memory key, uint256 tokenId, uint256 tokensLocked) external;

    function exitFarming(IncentiveKey memory key, uint256 tokenId) external;

    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data
    ) external;

    /// @notice Emitted when ownership of a deposit changes
    /// @param tokenId The ID of the deposit (and token) that is being transferred
    /// @param oldOwner The owner before the deposit was transferred
    /// @param newOwner The owner after the deposit was transferred
    event DepositTransferred(uint256 indexed tokenId, address indexed oldOwner, address indexed newOwner);
}
