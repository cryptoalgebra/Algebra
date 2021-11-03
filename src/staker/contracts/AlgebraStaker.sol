pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraStaker.sol';
import './libraries/IncentiveId.sol';
import './libraries/RewardMath.sol';
import './libraries/NFTPositionInfo.sol';
import 'hardhat/console.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';
import 'algebra-periphery/contracts/base/ERC721Permit.sol';

/// @title Algebra canonical staking interface
contract AlgebraStaker is IAlgebraStaker, ERC721Permit, Multicall {
    /// @notice Represents a staking incentive
    struct Incentive {
        uint256 totalReward;
        uint256 bonusReward;
        address virtualPoolAddress;
        uint96 numberOfStakes;
        bool isPoolCreated;
        uint224 totalLiquidity;
    }

    /// @notice Represents the deposit of a liquidity NFT
    struct Deposit {
        uint256 _tokenId;
        address owner;
        int24 tickLower;
        int24 tickUpper;
    }

    //
    struct _Deposit {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
    }

    /// @notice Represents a staked liquidity NFT
    struct Stake {
        uint96 liquidityNoOverflow;
        uint128 liquidityIfOverflow;
    }

    /// @inheritdoc IAlgebraStaker
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    IAlgebraPoolDeployer public immutable override deployer;

    IVirtualPoolDeployer public immutable override vdeployer;

    /// @inheritdoc IAlgebraStaker
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraStaker
    uint256 public immutable override maxIncentiveDuration;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint176 private _nextId = 1;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    /// @dev stakes[tokenId][incentiveHash] => Stake
    mapping(uint256 => mapping(bytes32 => Stake)) private _stakes;

    /// @dev _deposits[tokenId] => _Deposit
    mapping(uint256 => _Deposit) private _deposits;

    address private incentiveMaker;
    address private owner;

    // @inheritdoc IAlgebraPoolDeployer
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        require(incentiveMaker == address(0));
        incentiveMaker = _incentiveMaker;
    }

    /// @inheritdoc IAlgebraStaker
    function stakes(uint256 tokenId, bytes32 incentiveId) public view override returns (uint128 liquidity) {
        Stake storage stake = _stakes[tokenId][incentiveId];
        liquidity = stake.liquidityNoOverflow;
        if (liquidity == type(uint96).max) {
            liquidity = stake.liquidityIfOverflow;
        }
    }

    /// @dev rewards[rewardToken][owner] => uint256
    /// @inheritdoc IAlgebraStaker
    mapping(IERC20Minimal => mapping(address => uint256)) public override rewards;

    modifier isAuthorizedForToken(uint256 tokenId) {
        console.log('tokenIdu', tokenId);
        console.log('msg senderu', msg.sender);
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
        _;
    }

    modifier onlyIncentiveMaker() {
        require(msg.sender == incentiveMaker);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /// @param _nonfungiblePositionManager the NFT position manager contract address
    /// @param _maxIncentiveStartLeadTime the max duration of an incentive in seconds
    /// @param _maxIncentiveDuration the max amount of seconds into the future the incentive startTime can be set
    constructor(
        IAlgebraPoolDeployer _deployer,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IVirtualPoolDeployer _vdeployer,
        uint256 _maxIncentiveStartLeadTime,
        uint256 _maxIncentiveDuration
    ) ERC721Permit('Algebra Farming NFT-V1', 'ALGB-FARM', '2') {
        owner = msg.sender;
        deployer = _deployer;
        vdeployer = _vdeployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        maxIncentiveStartLeadTime = _maxIncentiveStartLeadTime;
        maxIncentiveDuration = _maxIncentiveDuration;
    }

    /// @inheritdoc IAlgebraStaker
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        (, uint32 _activeEndTimestamp, ) = key.pool.activeIncentive();
        require(
            _activeEndTimestamp < block.timestamp,
            'AlgebraStaker::createIncentive: there is already active incentive'
        );
        require(reward > 0, 'AlgebraStaker::createIncentive: reward must be positive');
        require(
            block.timestamp <= key.startTime,
            'AlgebraStaker::createIncentive: start time must be now or in the future'
        );
        require(
            key.startTime - block.timestamp <= maxIncentiveStartLeadTime,
            'AlgebraStaker::createIncentive: start time too far into future'
        );
        require(key.startTime < key.endTime, 'AlgebraStaker::createIncentive: start time must be before end time');
        require(
            key.endTime - key.startTime <= maxIncentiveDuration,
            'AlgebraStaker::createIncentive: incentive duration is too long'
        );

        bytes32 incentiveId = IncentiveId.compute(key);

        incentives[incentiveId].totalReward += reward;
        incentives[incentiveId].bonusReward += bonusReward;

        virtualPool = vdeployer.deploy(address(key.pool), address(this));
        key.pool.setIncentive(virtualPool, uint32(key.endTime), uint32(key.startTime));

        incentives[incentiveId].isPoolCreated = true;
        incentives[incentiveId].virtualPoolAddress = address(virtualPool);

        TransferHelper.safeTransferFrom(address(key.bonusRewardToken), msg.sender, address(this), bonusReward);
        TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), reward);

        emit IncentiveCreated(
            key.rewardToken,
            key.bonusRewardToken,
            key.pool,
            virtualPool,
            key.startTime,
            key.endTime,
            key.refundee,
            reward,
            bonusReward
        );
    }

    /// @notice Upon receiving a Algebra ERC721, creates the token deposit setting owner to `from`. Also stakes token
    /// in one or more incentives if properly formatted `data` has a length > 0.
    /// @inheritdoc IERC721Receiver
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        require(
            msg.sender == address(nonfungiblePositionManager),
            'AlgebraStaker::onERC721Received: not a  Algebra nft'
        );

        (, , , , int24 tickLower, int24 tickUpper, , , , , ) = nonfungiblePositionManager.positions(tokenId);

        deposits[tokenId] = Deposit({owner: from, _tokenId: 0, tickLower: tickLower, tickUpper: tickUpper});
        emit DepositTransferred(tokenId, address(0), from);

        if (data.length > 0) {
            if (data.length == 160) {
                _stakeToken(abi.decode(data, (IncentiveKey)), tokenId);
            } else {
                IncentiveKey[] memory keys = abi.decode(data, (IncentiveKey[]));
                for (uint256 i = 0; i < keys.length; i++) {
                    _stakeToken(keys[i], tokenId);
                }
            }
        }
        return this.onERC721Received.selector;
    }

    /// @inheritdoc IAlgebraStaker
    //function transferDeposit(uint256 tokenId, address to) external override {
    //    require(to != address(0), 'AlgebraStaker::transferDeposit: invalid transfer recipient');
    //    address owner = deposits[tokenId].owner;
    //    require(owner == msg.sender, 'AlgebraStaker::transferDeposit: can only be called by deposit owner');
    //    deposits[tokenId].owner = to;
    //    emit DepositTransferred(tokenId, owner, to);
    //}

    /// @inheritdoc IAlgebraStaker
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data
    ) external override {
        require(to != address(this), 'AlgebraStaker::withdrawToken: cannot withdraw to staker');
        Deposit memory deposit = deposits[tokenId];
        require(deposit._tokenId == 0, 'AlgebraStaker::withdrawToken: cannot withdraw token while staked');
        require(deposit.owner == msg.sender, 'AlgebraStaker::withdrawToken: only owner can withdraw token');

        delete deposits[tokenId];
        emit DepositTransferred(tokenId, deposit.owner, address(0));

        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, data);
    }

    /// @inheritdoc IAlgebraStaker
    function stakeToken(IncentiveKey memory key, uint256 tokenId) external override {
        require(deposits[tokenId].owner == msg.sender, 'AlgebraStaker::stakeToken: only owner can stake token');
        require(deposits[tokenId]._tokenId == 0, 'AlgebraStaker::stakeToken: already staked');
        _stakeToken(key, tokenId);
        _nextId++;
    }

    /// @inheritdoc IAlgebraStaker
    function unstakeToken(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId]._tokenId)
    {
        _unstakeToken(key, tokenId);
    }

    /// @inheritdoc IAlgebraStaker
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequested
    ) external override returns (uint256 reward) {
        reward = rewards[rewardToken][msg.sender];

        if (amountRequested != 0 && amountRequested < reward) {
            reward = amountRequested;
        }

        rewards[rewardToken][msg.sender] -= reward;
        TransferHelper.safeTransfer(address(rewardToken), to, reward);

        emit RewardClaimed(to, reward, address(rewardToken), msg.sender);
    }

    /// @inheritdoc IAlgebraStaker
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        view
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        bytes32 incentiveId = IncentiveId.compute(key);

        uint128 liquidity = stakes(tokenId, incentiveId);
        require(liquidity > 0, 'AlgebraStaker::getRewardInfo: stake does not exist');

        Deposit memory deposit = deposits[tokenId];
        Incentive memory incentive = incentives[incentiveId];

        (uint160 secondsPerLiquidityInsideX128, uint256 initTimestamp, uint256 endTimestamp) = IAlgebraVirtualPool(
            incentive.virtualPoolAddress
        ).getInnerSecondsPerLiquidity(deposit.tickLower, deposit.tickUpper);

        if (initTimestamp == 0) {
            initTimestamp = key.startTime;
            endTimestamp = key.endTime;
        }
        if (endTimestamp == 0) {
            endTimestamp = key.endTime;
        }

        reward = RewardMath.computeRewardAmount(
            incentive.totalReward,
            initTimestamp,
            endTimestamp,
            liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );

        bonusReward = RewardMath.computeRewardAmount(
            incentive.bonusReward,
            initTimestamp,
            endTimestamp,
            liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );
    }

    /// @dev Stakes a deposited token without doing an ownership check
    function _stakeToken(IncentiveKey memory key, uint256 tokenId) private {
        require(block.timestamp < key.startTime, 'AlgebraStaker::stakeToken: incentive has already started');

        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].totalReward > 0, 'AlgebraStaker::stakeToken: non-existent incentive');
        require(
            _stakes[tokenId][incentiveId].liquidityNoOverflow == 0,
            'AlgebraStaker::stakeToken: token already staked'
        );

        (IAlgebraPool pool, int24 tickLower, int24 tickUpper, uint128 liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'AlgebraStaker::stakeToken: token pool is not the incentive pool');
        require(liquidity > 0, 'AlgebraStaker::stakeToken: cannot stake token with 0 liquidity');

        incentives[incentiveId].numberOfStakes++;
        (, int24 tick, , , , , , ) = pool.globalState();
        IAlgebraVirtualPool virtualPool = IAlgebraVirtualPool(incentives[incentiveId].virtualPoolAddress);
        virtualPool.applyLiquidityDeltaToPosition(tickLower, tickUpper, int128(liquidity), tick);
        _mint(msg.sender, _nextId);
        console.log('tokenId', tokenId);
        console.log('msg sender', msg.sender);
        deposits[tokenId]._tokenId = _nextId;
        if (liquidity >= type(uint96).max) {
            _stakes[tokenId][incentiveId] = Stake({
                liquidityNoOverflow: type(uint96).max,
                liquidityIfOverflow: liquidity
            });
        } else {
            Stake storage stake = _stakes[tokenId][incentiveId];
            stake.liquidityNoOverflow = uint96(liquidity);
        }
        incentives[incentiveId].totalLiquidity += liquidity;

        emit TokenStaked(tokenId, _nextId, incentiveId, liquidity);
    }

    function burn(uint256 tokenId) private isAuthorizedForToken(tokenId) {
        delete _deposits[tokenId];
        _burn(tokenId);
    }

    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(_deposits[tokenId].nonce++);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        require(_exists(tokenId), 'ERC721: approved query for nonexistent token');

        return _deposits[tokenId].operator;
    }

    /// @dev Overrides _approve to use the operator in the position, which is packed with the position permit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        _deposits[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function _unstakeToken(IncentiveKey memory key, uint256 tokenId) private {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive storage incentive = incentives[incentiveId];
        // anyone can call unstakeToken if the block time is after the end time of the incentive
        require(block.timestamp > key.endTime, 'AlgebraStaker::unstakeToken: cannot unstake before end time');

        uint128 liquidity = stakes(tokenId, incentiveId);

        require(liquidity != 0, 'AlgebraStaker::unstakeToken: stake does not exist');

        deposits[tokenId].owner = msg.sender;
        Deposit memory deposit = deposits[tokenId];

        incentive.numberOfStakes--;

        (uint160 secondsPerLiquidityInsideX128, uint256 initTimestamp, uint256 endTimestamp) = IAlgebraVirtualPool(
            incentive.virtualPoolAddress
        ).getInnerSecondsPerLiquidity(deposit.tickLower, deposit.tickUpper);

        if (endTimestamp == 0) {
            IAlgebraVirtualPool(incentive.virtualPoolAddress).finish(uint32(block.timestamp), uint32(key.startTime));
            (secondsPerLiquidityInsideX128, initTimestamp, endTimestamp) = IAlgebraVirtualPool(
                incentive.virtualPoolAddress
            ).getInnerSecondsPerLiquidity(deposit.tickLower, deposit.tickUpper);
        }

        uint256 reward = RewardMath.computeRewardAmount(
            incentive.totalReward,
            initTimestamp,
            endTimestamp,
            liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );

        uint256 bonusReward = RewardMath.computeRewardAmount(
            incentive.bonusReward,
            initTimestamp,
            endTimestamp,
            liquidity,
            incentive.totalLiquidity,
            secondsPerLiquidityInsideX128
        );

        burn(deposits[tokenId]._tokenId);
        deposits[tokenId]._tokenId = 0;

        rewards[key.rewardToken][deposit.owner] += reward;
        rewards[key.bonusRewardToken][deposit.owner] += bonusReward;

        Stake storage stake = _stakes[tokenId][incentiveId];
        delete stake.liquidityNoOverflow;
        if (liquidity >= type(uint96).max) delete stake.liquidityIfOverflow;

        emit TokenUnstaked(
            tokenId,
            incentiveId,
            address(key.rewardToken),
            address(key.bonusRewardToken),
            deposit.owner,
            reward,
            bonusReward
        );
    }
}
