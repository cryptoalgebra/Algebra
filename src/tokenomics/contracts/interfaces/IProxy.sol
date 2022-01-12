// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IAlgebraVirtualPool.sol';

import 'algebra-periphery/contracts/interfaces/IMulticall.sol';
import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

import './IAlgebraFarming.sol';
import './IAlgebraEternalFarming.sol';
import './IAlgebraIncentiveVirtualPool.sol';
import './IAlgebraEternalVirtualPool.sol';
import './IIncentiveKey.sol';

interface IProxy is IAlgebraVirtualPool, IERC721Receiver, IIncentiveKey, IMulticall, IERC721Permit {
    struct VirtualPoolAddresses {
        IAlgebraVirtualPool virtualPool;
        IAlgebraEternalVirtualPool eternalVirtualPool;
    }

    /// @notice The nonfungible position manager with which this farming contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    function farming() external view returns (IAlgebraFarming);

    function eternalFarming() external view returns (IAlgebraEternalFarming);

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
    function deposits(uint256 tokenId)
        external
        view
        returns (
            uint256 L2TokenId,
            int24 tickLower,
            int24 tickUpper,
            uint32 numberOfStakes
        );

    function setProxyAddress(IAlgebraPool pool, address virtualPool) external;

    function enterEternalFarming(IncentiveKey memory key, uint256 tokenId) external;

    function exitEternalFarming(IncentiveKey memory key, uint256 tokenId) external;

    function collectRewards(IncentiveKey memory key, uint256 tokenId) external;

    function enterFarming(IncentiveKey memory key, uint256 tokenId) external;

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
