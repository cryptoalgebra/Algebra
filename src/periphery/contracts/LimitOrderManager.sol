// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';

import './interfaces/ILimitOrderManager.sol';
import './libraries/PositionKey.sol';
import './libraries/PoolAddress.sol';
import './base/LimitOrderManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';
import './base/PoolInitializer.sol';

import 'hardhat/console.sol';

/// @title NFT limitPositions
/// @notice Wraps Algebra  limitPositions in the ERC721 non-fungible token interface
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract LimitOrderManager is
    ILimitOrderManager,
    Multicall,
    ERC721Permit,
    PeripheryImmutableState,
    LimitOrderManagment,
    PeripheryValidation,
    SelfPermit
{
    struct LimitPosition {
        uint96 nonce;
        address operator;
        uint80 poolId;
        uint128 amount;
        int24 tick;
    }

    /// @dev IDs of pools assigned by this contract
    mapping(address => uint80) private _poolIds;

    /// @dev Pool keys by pool ID, to save on SSTOREs for limitPosition data
    mapping(uint80 => PoolAddress.PoolKey) private _poolIdToPoolKey;

    /// @dev The token ID limitPosition data
    mapping(uint256 => LimitPosition) private _limitPositions;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;
    /// @dev The ID of the next pool that is used for the first time. Skips 0
    uint80 private _nextPoolId = 1;

    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer
    )
        ERC721Permit('Algebra Positions NFT-V1', 'ALGB-POS', '1')
        PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer)
    {}

    function limitPositions(uint256 tokenId)
        external
        view
        override
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint128 amount,
            int24 tick
        )
    {
        LimitPosition memory limitPosition = _limitPositions[tokenId];
        require(limitPosition.poolId != 0, 'Invalid token ID');
        PoolAddress.PoolKey memory poolKey = _poolIdToPoolKey[limitPosition.poolId];
        return (
            limitPosition.nonce,
            limitPosition.operator,
            poolKey.token0,
            poolKey.token1,
            limitPosition.amount,
            limitPosition.tick
        );
    }

    /// @dev Caches a pool key
    function cachePoolKey(address pool, PoolAddress.PoolKey memory poolKey) private returns (uint80 poolId) {
        poolId = _poolIds[pool];
        if (poolId == 0) {
            _poolIds[pool] = (poolId = _nextPoolId++);
            _poolIdToPoolKey[poolId] = poolKey;
        }
    }

    function addLimitOrder(addLimitOrderParams calldata params) external payable override returns (uint256 tokenId) {
        IAlgebraPool pool;

        pool = createLimitOrder(params.token0, params.token1, params.tick, params.amount);
        console.log(msg.sender);
        _mint(msg.sender, (tokenId = _nextId++));

        // idempotent set
        uint80 poolId = cachePoolKey(
            address(pool),
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1})
        );

        _limitPositions[tokenId] = LimitPosition({
            nonce: 0,
            operator: address(0),
            poolId: poolId,
            tick: params.tick,
            amount: params.amount
        });
    }

    modifier isAuthorizedForToken(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
        _;
    }

    // save bytecode by removing implementation of unused method
    function baseURI() public pure override returns (string memory) {}

    function burn(uint256 tokenId) external payable override isAuthorizedForToken(tokenId) {
        delete _limitPositions[tokenId];
        _burn(tokenId);
    }

    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(_limitPositions[tokenId].nonce++);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        require(_exists(tokenId), 'ERC721: approved query for nonexistent token');

        return _limitPositions[tokenId].operator;
    }

    /// @dev Overrides _approve to use the operator in the limitPosition, which is packed with the limitPosition permit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        _limitPositions[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }
}
