// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './interfaces/IPositionFollower.sol';
import './libraries/PoolInteraction.sol';
import './libraries/PoolAddress.sol';
import './base/LiquidityManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';
import './base/PoolInitializer.sol';

/// @title Algebra Integral 1.2.2 NFT positions
/// @notice Wraps Algebra positions in the ERC721 non-fungible token interface
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract NonfungiblePositionManager is
    INonfungiblePositionManager,
    Multicall,
    ERC721Permit,
    PeripheryImmutableState,
    PoolInitializer,
    LiquidityManagement,
    PeripheryValidation,
    SelfPermit
{
    using PoolInteraction for IAlgebraPool;

    // details about the Algebra position
    struct Position {
        uint88 nonce; // the nonce for permits
        address operator; // the address that is approved for spending this token
        uint80 poolId; // the ID of the pool with which this token is connected
        int24 tickLower; // the tick range of the position
        int24 tickUpper;
        uint128 liquidity; // the liquidity of the position
        uint256 feeGrowthInside0LastX128; // the fee growth of the aggregate position as of the last action on the individual position
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0; // how many uncollected tokens are owed to the position, as of the last computation
        uint128 tokensOwed1;
    }

    /// @dev The role which has the right to change the farming center address
    bytes32 public constant NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE =
        keccak256('NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE');

    /// @inheritdoc INonfungiblePositionManager
    address public override farmingCenter;

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 tokenId => address farmingCenterAddress) public override farmingApprovals;

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 tokenId => address farmingCenterAddress) public tokenFarmedIn;

    /// @dev The address of the token descriptor contract, which handles generating token URIs for position tokens
    address private immutable _tokenDescriptor;

    /// @dev IDs of pools assigned by this contract
    mapping(address poolAddress => uint80 poolId) private _poolIds;

    /// @dev Pool keys by pool ID, to save on SSTOREs for position data
    mapping(uint80 poolId => PoolAddress.PoolKey poolKey) private _poolIdToPoolKey;

    /// @dev The token ID position data
    mapping(uint256 tokenId => Position position) private _positions;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;
    /// @dev The ID of the next pool that is used for the first time. Skips 0
    uint80 private _nextPoolId = 1;

    modifier isAuthorizedForToken(uint256 tokenId) {
        _checkAuthorizationForToken(tokenId);
        _;
    }

    constructor(
        address _factory,
        address _WNativeToken,
        address _tokenDescriptor_,
        address _poolDeployer
    )
        ERC721Permit('Algebra Positions NFT-V2', 'ALGB-POS', '2')
        PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer)
    {
        _tokenDescriptor = _tokenDescriptor_;
    }

    /// @inheritdoc INonfungiblePositionManager
    function positions(
        uint256 tokenId
    )
        external
        view
        override
        returns (
            uint88 nonce,
            address operator,
            address token0,
            address token1,
            address deployer,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        Position storage position = _positions[tokenId];
        // single SLOAD
        uint80 poolId = position.poolId;
        tickLower = position.tickLower;
        tickUpper = position.tickUpper;
        liquidity = position.liquidity;
        require(poolId != 0, 'Invalid token ID');
        PoolAddress.PoolKey storage poolKey = _poolIdToPoolKey[poolId];
        return (
            position.nonce,
            position.operator,
            poolKey.token0,
            poolKey.token1,
            poolKey.deployer,
            tickLower,
            tickUpper,
            liquidity,
            position.feeGrowthInside0LastX128,
            position.feeGrowthInside1LastX128,
            position.tokensOwed0,
            position.tokensOwed1
        );
    }

    /// @inheritdoc INonfungiblePositionManager
    function mint(
        MintParams calldata params
    )
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        IAlgebraPool pool;
        uint128 liquidityDesired;
        (liquidityDesired, liquidity, amount0, amount1, pool) = addLiquidity(
            AddLiquidityParams({
                token0: params.token0,
                token1: params.token1,
                deployer: params.deployer,
                recipient: address(this),
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min
            })
        );
        unchecked {
            _mint(params.recipient, (tokenId = _nextId++));
        }

        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool._getPositionInPool(
            address(this),
            params.tickLower,
            params.tickUpper
        );

        // idempotent set
        uint80 poolId = _cachePoolKey(
            address(pool),
            PoolAddress.PoolKey({deployer: params.deployer, token0: params.token0, token1: params.token1})
        );

        _positions[tokenId] = Position({
            nonce: 0,
            operator: address(0),
            poolId: poolId,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            feeGrowthInside0LastX128: feeGrowthInside0LastX128,
            feeGrowthInside1LastX128: feeGrowthInside1LastX128,
            tokensOwed0: 0,
            tokensOwed1: 0
        });

        emit IncreaseLiquidity(tokenId, liquidityDesired, liquidity, amount0, amount1, address(pool));
    }

    /// @dev Caches a pool key
    function _cachePoolKey(address pool, PoolAddress.PoolKey memory poolKey) private returns (uint80 poolId) {
        if ((poolId = _poolIds[pool]) == 0) {
            unchecked {
                _poolIds[pool] = (poolId = _nextPoolId++);
            }
            _poolIdToPoolKey[poolId] = poolKey;
        }
    }

    function _getPoolById(uint80 poolId) private view returns (address) {
        return PoolAddress.computeAddress(poolDeployer, _poolIdToPoolKey[poolId]);
    }

    function _updateUncollectedFees(
        Position storage position,
        IAlgebraPool pool,
        address owner,
        int24 tickLower,
        int24 tickUpper,
        uint128 positionLiquidity
    ) private returns (uint128 tokensOwed0, uint128 tokensOwed1) {
        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool._getPositionInPool(
            owner,
            tickLower,
            tickUpper
        );
        unchecked {
            tokensOwed0 = uint128(
                FullMath.mulDiv(
                    feeGrowthInside0LastX128 - position.feeGrowthInside0LastX128,
                    positionLiquidity,
                    Constants.Q128
                )
            );
            tokensOwed1 = uint128(
                FullMath.mulDiv(
                    feeGrowthInside1LastX128 - position.feeGrowthInside1LastX128,
                    positionLiquidity,
                    Constants.Q128
                )
            );
        }

        position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
        position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;
    }

    /// @inheritdoc INonfungiblePositionManager
    function increaseLiquidity(
        IncreaseLiquidityParams calldata params
    )
        external
        payable
        override
        checkDeadline(params.deadline)
        returns (uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        Position storage position = _positions[params.tokenId];

        PoolAddress.PoolKey storage poolKey = _poolIdToPoolKey[position.poolId];
        int24 tickLower = position.tickLower;
        int24 tickUpper = position.tickUpper;
        uint128 positionLiquidity = position.liquidity;

        IAlgebraPool pool;
        uint128 liquidityDesired;
        (liquidityDesired, liquidity, amount0, amount1, pool) = addLiquidity(
            AddLiquidityParams({
                token0: poolKey.token0,
                token1: poolKey.token1,
                deployer: poolKey.deployer,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                recipient: address(this)
            })
        );

        // this is now updated to the current transaction
        (uint128 tokensOwed0, uint128 tokensOwed1) = _updateUncollectedFees(
            position,
            pool,
            address(this),
            tickLower,
            tickUpper,
            positionLiquidity
        );

        unchecked {
            if (tokensOwed0 | tokensOwed1 != 0) {
                position.tokensOwed0 += tokensOwed0;
                position.tokensOwed1 += tokensOwed1;
            }
            position.liquidity = positionLiquidity + liquidity;
        }

        emit IncreaseLiquidity(params.tokenId, liquidityDesired, liquidity, amount0, amount1, address(pool));

        _applyLiquidityDeltaInFarming(params.tokenId, int256(uint256(liquidity)));
    }

    /// @inheritdoc INonfungiblePositionManager
    function decreaseLiquidity(
        DecreaseLiquidityParams calldata params
    )
        external
        payable
        override
        isAuthorizedForToken(params.tokenId)
        checkDeadline(params.deadline)
        returns (uint256 amount0, uint256 amount1)
    {
        require(params.liquidity > 0);
        Position storage position = _positions[params.tokenId];

        (uint80 poolId, int24 tickLower, int24 tickUpper, uint128 positionLiquidity) = (
            position.poolId,
            position.tickLower,
            position.tickUpper,
            position.liquidity
        );
        require(positionLiquidity >= params.liquidity);

        IAlgebraPool pool = IAlgebraPool(_getPoolById(poolId));
        (amount0, amount1) = pool._burnPositionInPool(tickLower, tickUpper, params.liquidity);

        require(amount0 >= params.amount0Min && amount1 >= params.amount1Min, 'Price slippage check');

        // scope to prevent stack-too-deep
        {
            // this is now updated to the current transaction
            (uint128 tokensOwed0, uint128 tokensOwed1) = _updateUncollectedFees(
                position,
                pool,
                address(this),
                tickLower,
                tickUpper,
                positionLiquidity
            );

            unchecked {
                position.tokensOwed0 += uint128(amount0) + tokensOwed0;
                position.tokensOwed1 += uint128(amount1) + tokensOwed1;

                // subtraction is safe because we checked positionLiquidity is gte params.liquidity
                position.liquidity = positionLiquidity - params.liquidity;
            }
        }

        emit DecreaseLiquidity(params.tokenId, params.liquidity, amount0, amount1);

        _applyLiquidityDeltaInFarming(params.tokenId, -int256(uint256(params.liquidity)));
    }

    /// @inheritdoc INonfungiblePositionManager
    function collect(
        CollectParams calldata params
    ) external payable override isAuthorizedForToken(params.tokenId) returns (uint256 amount0, uint256 amount1) {
        require(params.amount0Max > 0 || params.amount1Max > 0);
        // allow collecting to the nft position manager address with address 0
        address recipient = params.recipient == address(0) ? address(this) : params.recipient;

        Position storage position = _positions[params.tokenId];
        IAlgebraPool pool = IAlgebraPool(_getPoolById(position.poolId));

        // trigger an update of the position fees owed and fee growth snapshots if it has any liquidity
        int24 tickLower = position.tickLower;
        int24 tickUpper = position.tickUpper;
        uint128 positionLiquidity = position.liquidity;

        (uint128 tokensOwed0, uint128 tokensOwed1) = (position.tokensOwed0, position.tokensOwed1);
        if (positionLiquidity > 0) {
            pool._burnPositionInPool(tickLower, tickUpper, 0);
            (uint128 _tokensOwed0, uint128 _tokensOwed1) = _updateUncollectedFees(
                position,
                pool,
                address(this),
                tickLower,
                tickUpper,
                positionLiquidity
            );

            unchecked {
                tokensOwed0 += _tokensOwed0;
                tokensOwed1 += _tokensOwed1;
            }
        }

        // compute the arguments to give to the pool#collect method
        (uint128 amount0Collect, uint128 amount1Collect) = (
            params.amount0Max > tokensOwed0 ? tokensOwed0 : params.amount0Max,
            params.amount1Max > tokensOwed1 ? tokensOwed1 : params.amount1Max
        );

        // the actual amounts collected are returned
        (amount0, amount1) = pool.collect(recipient, tickLower, tickUpper, amount0Collect, amount1Collect);

        // sometimes there will be a few less wei than expected due to rounding down in core, but we just subtract the full amount expected
        // instead of the actual amount so we can burn the token
        unchecked {
            (position.tokensOwed0, position.tokensOwed1) = (tokensOwed0 - amount0Collect, tokensOwed1 - amount1Collect);
        }

        emit Collect(params.tokenId, recipient, amount0Collect, amount1Collect);
    }

    /// @inheritdoc INonfungiblePositionManager
    function burn(uint256 tokenId) external payable override isAuthorizedForToken(tokenId) {
        Position storage position = _positions[tokenId];
        require(position.liquidity | position.tokensOwed0 | position.tokensOwed1 == 0);

        delete _positions[tokenId];
        delete tokenFarmedIn[tokenId];
        _burn(tokenId);
    }

    /// @inheritdoc INonfungiblePositionManager
    function rebalance(
        RebalanceParams calldata params
    )
        external
        payable
        override
        isAuthorizedForToken(params.tokenId)
        checkDeadline(params.deadline)
        returns (uint128 liquidity, uint256 amount0, uint256 amount1, uint256 fees0, uint256 fees1)
    {
        Position storage position = _positions[params.tokenId];
        require(tokenFarmedIn[params.tokenId] == address(0), 'Position is farmed');

        uint80 poolId = position.poolId;
        PoolAddress.PoolKey storage poolKey = _poolIdToPoolKey[poolId];
        IAlgebraPool pool = IAlgebraPool(PoolAddress.computeAddress(poolDeployer, poolKey));

        // dismantle old position, collect fees to caller
        {
            int24 oldTickLower = position.tickLower;
            int24 oldTickUpper = position.tickUpper;
            uint128 oldLiquidity = position.liquidity;

            uint256 burnedAmount0;
            uint256 burnedAmount1;

            if (oldLiquidity > 0) {
                (burnedAmount0, burnedAmount1) = pool._burnPositionInPool(oldTickLower, oldTickUpper, oldLiquidity);
            }

            (uint256 collected0, uint256 collected1) = pool.collect(
                msg.sender,
                oldTickLower,
                oldTickUpper,
                type(uint128).max,
                type(uint128).max
            );
            // TODO: send fees to caller
            fees0 = collected0 - burnedAmount0;
            fees1 = collected1 - burnedAmount1;
        }

        // TODO: pass via params
        uint256 amount0Desired = params.amount0Desired;
        uint256 amount1Desired = params.amount1Desired;
        if (amount0Desired == type(uint256).max) amount0Desired = IERC20(poolKey.token0).balanceOf(msg.sender);
        if (amount1Desired == type(uint256).max) amount1Desired = IERC20(poolKey.token1).balanceOf(msg.sender);

        uint128 liquidityDesired;
        (liquidityDesired, liquidity, amount0, amount1, ) = addLiquidity(
            AddLiquidityParams({
                token0: poolKey.token0,
                token1: poolKey.token1,
                deployer: poolKey.deployer,
                recipient: address(this),
                tickLower: params.newTickLower,
                tickUpper: params.newTickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min
            })
        );

        // update nfpm position
        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool._getPositionInPool(
            address(this),
            params.newTickLower,
            params.newTickUpper
        );

        position.tickLower = params.newTickLower;
        position.tickUpper = params.newTickUpper;
        position.liquidity = liquidity;
        position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
        position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;
        position.tokensOwed0 = 0;
        position.tokensOwed1 = 0;

        emit Rebalance(params.tokenId, params.newTickLower, params.newTickUpper, liquidity, amount0, amount1, fees0, fees1);
    }

    /// @inheritdoc INonfungiblePositionManager
    function rebalanceMultiple(
        RebalanceParams[] calldata params,
        uint256 deadline
    )
        external
        payable
        override
        checkDeadline(deadline)
        returns (uint256 totalFees0, uint256 totalFees1)
    {

        for (uint256 i; i < params.length; ) {
            uint256 tokenId = params[i].tokenId;
            _checkAuthorizationForToken(tokenId);

            Position storage position = _positions[tokenId];
            require(tokenFarmedIn[tokenId] == address(0), 'Position is farmed');

            uint80 poolId = position.poolId;
            IAlgebraPool pool = IAlgebraPool(_getPoolById(poolId));

            int24 oldTickLower = position.tickLower;
            int24 oldTickUpper = position.tickUpper;
            uint128 oldLiquidity = position.liquidity;

            uint256 burnedAmount0;
            uint256 burnedAmount1;

            if (oldLiquidity > 0) {
                (burnedAmount0, burnedAmount1) = pool._burnPositionInPool(oldTickLower, oldTickUpper, oldLiquidity);
            }

            (uint256 collected0, uint256 collected1) = pool.collect(
                msg.sender,
                oldTickLower,
                oldTickUpper,
                type(uint128).max,
                type(uint128).max
            );
            // TODO: send fees to caller
            unchecked {
                totalFees0 += collected0 - burnedAmount0;
                totalFees1 += collected1 - burnedAmount1;
            }

            position.tokensOwed0 = 0;
            position.tokensOwed1 = 0;

            unchecked { ++i; }
        }

        for (uint256 i; i < params.length; ) {
            Position storage position = _positions[params[i].tokenId];
            uint80 poolId = position.poolId;
            PoolAddress.PoolKey storage poolKey = _poolIdToPoolKey[poolId];

            uint128 liquidity;
            uint256 amount0;
            uint256 amount1;
            IAlgebraPool pool;

            {
                uint256 a0Desired = params[i].amount0Desired;
                uint256 a1Desired = params[i].amount1Desired;
                if (a0Desired == type(uint256).max) a0Desired = IERC20(poolKey.token0).balanceOf(msg.sender);
                if (a1Desired == type(uint256).max) a1Desired = IERC20(poolKey.token1).balanceOf(msg.sender);

                uint128 liquidityDesired;
                (liquidityDesired, liquidity, amount0, amount1, pool) = addLiquidity(
                    AddLiquidityParams({
                        token0: poolKey.token0,
                        token1: poolKey.token1,
                        deployer: poolKey.deployer,
                        recipient: address(this),
                        tickLower: params[i].newTickLower,
                        tickUpper: params[i].newTickUpper,
                        amount0Desired: a0Desired,
                        amount1Desired: a1Desired,
                        amount0Min: params[i].amount0Min,
                        amount1Min: params[i].amount1Min
                    })
                );
            }

            (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = pool._getPositionInPool(
                address(this),
                params[i].newTickLower,
                params[i].newTickUpper
            );

            position.tickLower = params[i].newTickLower;
            position.tickUpper = params[i].newTickUpper;
            position.liquidity = liquidity;
            position.feeGrowthInside0LastX128 = feeGrowthInside0LastX128;
            position.feeGrowthInside1LastX128 = feeGrowthInside1LastX128;

            emit Rebalance(params[i].tokenId, params[i].newTickLower, params[i].newTickUpper, liquidity, amount0, amount1, 0, 0);

            unchecked { ++i; }
        }
    }

    /// @inheritdoc INonfungiblePositionManager
    function approveForFarming(
        uint256 tokenId,
        bool approve,
        address farmingAddress
    ) external payable override isAuthorizedForToken(tokenId) {
        address newValue;
        if (approve) {
            require(farmingAddress == farmingCenter);
            newValue = farmingAddress;
        }
        farmingApprovals[tokenId] = newValue;
    }

    /// @inheritdoc INonfungiblePositionManager
    function switchFarmingStatus(uint256 tokenId, bool toActive) external override {
        address _farmingCenter = farmingCenter;
        bool accessAllowed = msg.sender == _farmingCenter;
        address newFarmForToken;
        if (toActive) {
            require(farmingApprovals[tokenId] == _farmingCenter, 'Not approved for farming');
            newFarmForToken = _farmingCenter;
        } else {
            // can be switched off by current farming center or by the farming center in which nft is farmed
            accessAllowed = accessAllowed || msg.sender == tokenFarmedIn[tokenId];
        }
        require(accessAllowed, 'Only FarmingCenter');
        tokenFarmedIn[tokenId] = newFarmForToken;
    }

    /// @inheritdoc INonfungiblePositionManager
    function setFarmingCenter(address newFarmingCenter) external override {
        require(IAlgebraFactory(factory).hasRoleOrOwner(NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE, msg.sender));
        farmingCenter = newFarmingCenter;
    }

    /// @inheritdoc IERC721Metadata
    function tokenURI(uint256 tokenId) public view override(ERC721, IERC721Metadata) returns (string memory) {
        _requireMinted(tokenId);
        return INonfungibleTokenPositionDescriptor(_tokenDescriptor).tokenURI(this, tokenId);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        _requireMinted(tokenId);
        return _positions[tokenId].operator;
    }

    /// @inheritdoc INonfungiblePositionManager
    function isApprovedOrOwner(address spender, uint256 tokenId) external view override returns (bool) {
        _requireMinted(tokenId);
        return _isApprovedOrOwner(spender, tokenId);
    }

    function _checkAuthorizationForToken(uint256 tokenId) internal view {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
    }

    function _applyLiquidityDeltaInFarming(uint256 tokenId, int256 liquidityDelta) private {
        address _tokenFarmedIn = tokenFarmedIn[tokenId];
        if (_tokenFarmedIn == address(0)) return;

        address _farmingCenter = farmingCenter;
        if (_farmingCenter == address(0)) return;

        if (_tokenFarmedIn == _farmingCenter) {
            // errors without message (i.e. out of gas) will be propagated
            // custom errors will be propagated
            try IPositionFollower(_farmingCenter).applyLiquidityDelta(tokenId, liquidityDelta) {
                // do nothing
            } catch Panic(uint256) {
                emit FarmingFailed(tokenId);
            } catch Error(string memory) {
                emit FarmingFailed(tokenId);
            }
        }
    }

    /// @dev Gets the current nonce for a token ID and then increments it, returning the original value
    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        unchecked {
            return uint256(_positions[tokenId].nonce++);
        }
    }

    /// @dev Overrides to clear operator and farming approval before any transfer (including burn, but not including mint)
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batch) internal override {
        // transfer from address(0) is mint
        if (from != address(0)) {
            // clear approvals
            _positions[tokenId].operator = address(0);
            delete farmingApprovals[tokenId];
        }
        super._beforeTokenTransfer(from, to, tokenId, batch);
    }

    /// @dev Overrides _approve to use the operator in the position, which is packed with the position permit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        _positions[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }
}
