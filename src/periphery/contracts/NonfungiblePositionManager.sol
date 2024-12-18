// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';

import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './interfaces/IPositionFollower.sol';
import './libraries/PoolInteraction.sol';
import './libraries/OracleLibrary.sol';
import './libraries/PoolAddress.sol';
import './base/LiquidityManagement.sol';
import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/ERC721Permit.sol';
import './base/PeripheryValidation.sol';
import './base/SelfPermit.sol';
import './base/PoolInitializer.sol';

/// @title Algebra Integral 1.0 NFT positions
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

    // details about withdrawal fee for position
    struct PositionWithdrawalFee {
        uint32 lastUpdateTimestamp; // last increase/decrease liquidity timestamp
        uint128 withdrawalFeeLiquidity; // liqudity of accumulated withdrawal fee
    }

    /// @dev The role which has the right to change the farming center address
    bytes32 public constant NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE =
        keccak256('NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE');

    uint64 public constant FEE_DENOMINATOR = 1e3;

    /// @inheritdoc INonfungiblePositionManager
    address public override farmingCenter;

    /// @inheritdoc INonfungiblePositionManager
    address public override defaultWithdrawalFeesVault;

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 tokenId => address farmingCenterAddress) public override farmingApprovals;

    /// @inheritdoc INonfungiblePositionManager
    mapping(uint256 tokenId => address farmingCenterAddress) public tokenFarmedIn;

    mapping(address pool => WithdrawalFeePoolParams params) private withdrawalFeePoolParams;

    /// @dev The address of the token descriptor contract, which handles generating token URIs for position tokens
    address private immutable _tokenDescriptor;

    /// @dev IDs of pools assigned by this contract
    mapping(address poolAddress => uint80 poolId) private _poolIds;

    /// @dev Pool keys by pool ID, to save on SSTOREs for position data
    mapping(uint80 poolId => PoolAddress.PoolKey poolKey) private _poolIdToPoolKey;

    /// @dev The token ID position data
    mapping(uint256 tokenId => Position position) private _positions;

    /// @dev The token ID withdrawal fee position data
    mapping(uint256 tokenId => PositionWithdrawalFee data) private _positionsWithdrawalFee;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;
    /// @dev The ID of the next pool that is used for the first time. Skips 0
    uint80 private _nextPoolId = 1;

    modifier isAuthorizedForToken(uint256 tokenId) {
        _checkAuthorizationForToken(tokenId);
        _;
    }

    modifier onlyAdministrator() {
        _hasRoleOrOwner();
        _;
    }

    constructor(
        address _factory,
        address _WNativeToken,
        address _tokenDescriptor_,
        address _poolDeployer,
        address _vault
    )
        ERC721Permit('Algebra Positions NFT-V2', 'ALGB-POS', '2')
        PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer)
    {
        _tokenDescriptor = _tokenDescriptor_;
        require(_vault != address(0));
        defaultWithdrawalFeesVault = _vault;
    }

    function positionsWithdrawalFee(
        uint256 tokenId
    ) external view override returns (uint32 lastUpdateTimestamp, uint128 withdrawalFeeLiquidity) {
        PositionWithdrawalFee memory _position = _positionsWithdrawalFee[tokenId];
        return (_position.lastUpdateTimestamp, _position.withdrawalFeeLiquidity);
    }

    function getWithdrawalFeePoolParams(
        address pool
    ) external view override returns (WithdrawalFeePoolParams memory params) {
        return withdrawalFeePoolParams[pool];
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
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1})
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

        _positionsWithdrawalFee[tokenId] = PositionWithdrawalFee({
            lastUpdateTimestamp: uint32(_blockTimestamp()),
            withdrawalFeeLiquidity: 0
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

    function _calculateWithdrawalFees(
        address pool,
        uint32 lastUpdateTimestamp,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) private view returns (uint128 withdrawalFeeLiquidity) {
        WithdrawalFeePoolParams memory params = withdrawalFeePoolParams[pool];

        uint256 token0apr = params.apr0;
        uint256 token1apr = params.apr1;
        uint16 withdrawalFee = params.withdrawalFee;

        if ((token0apr > 0 || token1apr > 0) && withdrawalFee > 0) {
            uint32 period = uint32(_blockTimestamp()) - lastUpdateTimestamp;

            if (period == 0) return 0;
            address oracle = IAlgebraPool(pool).plugin();

            if (oracle == address(0)) return 0;
            int24 timeWeightedAverageTick = OracleLibrary.consult(oracle, period);

            uint160 tickLowerPrice = TickMath.getSqrtRatioAtTick(tickLower);
            uint160 tickUpperPrice = TickMath.getSqrtRatioAtTick(tickUpper);

            (uint256 averageAmount0, uint256 averageAmount1) = LiquidityAmounts.getAmountsForLiquidity(
                TickMath.getSqrtRatioAtTick(timeWeightedAverageTick),
                tickLowerPrice,
                tickUpperPrice,
                liquidity
            );

            if (token0apr > 0) {
                uint256 amount0EarnedFromStake = (token0apr * period * averageAmount0) / (FEE_DENOMINATOR * 365 days);
                uint128 amount0ToWithdraw = uint128((amount0EarnedFromStake * withdrawalFee) / FEE_DENOMINATOR);
                withdrawalFeeLiquidity += LiquidityAmounts.getLiquidityForAmount0(
                    tickLowerPrice,
                    tickUpperPrice,
                    amount0ToWithdraw
                );
            }

            if (token1apr > 0) {
                uint256 amount1EarnedFromStake = (token1apr * period * averageAmount1) / (FEE_DENOMINATOR * 365 days);
                uint128 amount1ToWithdraw = uint128((amount1EarnedFromStake * withdrawalFee) / FEE_DENOMINATOR);
                withdrawalFeeLiquidity += LiquidityAmounts.getLiquidityForAmount1(
                    tickLowerPrice,
                    tickUpperPrice,
                    amount1ToWithdraw
                );
            }
        }
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

        {
            PositionWithdrawalFee storage _position = _positionsWithdrawalFee[params.tokenId];
            uint128 withdrawalFeeLiquidity = _calculateWithdrawalFees(
                address(pool),
                _position.lastUpdateTimestamp,
                tickLower,
                tickUpper,
                positionLiquidity
            );
            _position.lastUpdateTimestamp = uint32(_blockTimestamp());
            _position.withdrawalFeeLiquidity += withdrawalFeeLiquidity;
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

        uint128 positionWithdrawalFeeLiquidity;
        {
            PositionWithdrawalFee storage _position = _positionsWithdrawalFee[params.tokenId];
            positionWithdrawalFeeLiquidity = _position.withdrawalFeeLiquidity;
            positionWithdrawalFeeLiquidity += _calculateWithdrawalFees(
                address(pool),
                _position.lastUpdateTimestamp,
                tickLower,
                tickUpper,
                positionLiquidity
            );
            _position.lastUpdateTimestamp = uint32(_blockTimestamp());
            positionWithdrawalFeeLiquidity = positionWithdrawalFeeLiquidity > positionLiquidity
                ? positionLiquidity
                : positionWithdrawalFeeLiquidity;

            _position.withdrawalFeeLiquidity = 0;
        }

        if (positionWithdrawalFeeLiquidity > 0) {
            (amount0, amount1) = pool._burnPositionInPool(tickLower, tickUpper, positionWithdrawalFeeLiquidity);
            FeesVault[] memory vaults = withdrawalFeePoolParams[address(pool)].feeVaults;
            if (vaults.length == 0) {
                pool.collect(defaultWithdrawalFeesVault, tickLower, tickUpper, uint128(amount0), uint128(amount1));
            } else {
                for (uint i = 0; i < vaults.length; i++) {
                    uint16 feePart = vaults[i].fee;
                    pool.collect(
                        vaults[i].feeVault,
                        tickLower,
                        tickUpper,
                        uint128((amount0 * feePart) / FEE_DENOMINATOR),
                        uint128((amount1 * feePart) / FEE_DENOMINATOR)
                    );
                }
            }
        }

        uint128 liquidityDeltaWithoutFee = params.liquidity > positionLiquidity - positionWithdrawalFeeLiquidity
            ? positionLiquidity - positionWithdrawalFeeLiquidity
            : params.liquidity;

        (amount0, amount1) = pool._burnPositionInPool(tickLower, tickUpper, liquidityDeltaWithoutFee);

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
                position.liquidity = positionLiquidity - liquidityDeltaWithoutFee - positionWithdrawalFeeLiquidity;
            }
        }

        emit DecreaseLiquidity(
            params.tokenId,
            liquidityDeltaWithoutFee,
            positionWithdrawalFeeLiquidity,
            amount0,
            amount1
        );

        _applyLiquidityDeltaInFarming(
            params.tokenId,
            -int256(uint256(liquidityDeltaWithoutFee + positionWithdrawalFeeLiquidity))
        );
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
    function setFarmingCenter(address newFarmingCenter) external override onlyAdministrator {
        farmingCenter = newFarmingCenter;
        emit FarmingCenter(newFarmingCenter);
    }

    /// @inheritdoc INonfungiblePositionManager
    function setTokenAPR(address pool, uint64 _apr0, uint64 _apr1) external override onlyAdministrator {
        require(_apr0 <= FEE_DENOMINATOR && _apr1 <= FEE_DENOMINATOR);
        WithdrawalFeePoolParams storage params = withdrawalFeePoolParams[pool];
        params.apr0 = _apr0;
        params.apr1 = _apr1;
    }

    function setVaultsForPool(
        address pool,
        uint16[] memory fees,
        address[] memory vaults
    ) external override onlyAdministrator {
        uint16 totalFee;
        FeesVault[] storage vaultsForPool = withdrawalFeePoolParams[pool].feeVaults;
        require(vaults.length == fees.length, 'Vaults and fees length mismatch');
        if (vaultsForPool.length != 0 || fees.length == 0) {
            delete withdrawalFeePoolParams[pool].feeVaults;
        }
        for (uint256 i = 0; i < fees.length; i++) {
            require(vaults[i] != address(0), 'Vault address cannot be 0');
            vaultsForPool.push(FeesVault(vaults[i], fees[i]));
            totalFee += fees[i];
            emit FeeVaultForPool(pool, vaults[i], fees[i]);
        }
        if (fees.length != 0) {
            require(totalFee == FEE_DENOMINATOR, 'Total fee must be equal to FEE_DENOMINATOR');
            withdrawalFeePoolParams[pool].feeVaults = vaultsForPool;
        }
    }

    /// @inheritdoc INonfungiblePositionManager
    function setWithdrawalFee(address pool, uint16 newWithdrawalFee) external override onlyAdministrator {
        require(newWithdrawalFee <= FEE_DENOMINATOR);
        withdrawalFeePoolParams[pool].withdrawalFee = newWithdrawalFee;
    }

    /// @inheritdoc INonfungiblePositionManager
    function setVaultAddress(address newVault) external override onlyAdministrator {
        require(newVault != address(0));
        defaultWithdrawalFeesVault = newVault;
    }

    function calculateLatestWithdrawalFeesLiquidity(
        uint256 tokenId
    ) external view override returns (uint128 latestWithdrawalFeeLiquidity) {
        Position memory position = _positions[tokenId];
        address pool = _getPoolById(position.poolId);
        PositionWithdrawalFee memory positionWithdrawalFee = _positionsWithdrawalFee[tokenId];

        latestWithdrawalFeeLiquidity =
            positionWithdrawalFee.withdrawalFeeLiquidity +
            _calculateWithdrawalFees(
                pool,
                positionWithdrawalFee.lastUpdateTimestamp,
                position.tickLower,
                position.tickUpper,
                position.liquidity
            );
    }

    function calculatePendingWithdrawalFeesLiquidity(
        uint256 tokenId
    ) external view override returns (uint128 pendingWithdrawalFeeLiquidity) {
        Position memory position = _positions[tokenId];
        address pool = _getPoolById(position.poolId);
        uint32 lastUpdateTimestamp = _positionsWithdrawalFee[tokenId].lastUpdateTimestamp;

        pendingWithdrawalFeeLiquidity = _calculateWithdrawalFees(
            pool,
            lastUpdateTimestamp,
            position.tickLower,
            position.tickUpper,
            position.liquidity
        );
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

    function _checkAuthorizationForToken(uint256 tokenId) private view {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
    }

    function _hasRoleOrOwner() private view {
        require(IAlgebraFactory(factory).hasRoleOrOwner(NONFUNGIBLE_POSITION_MANAGER_ADMINISTRATOR_ROLE, msg.sender));
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
