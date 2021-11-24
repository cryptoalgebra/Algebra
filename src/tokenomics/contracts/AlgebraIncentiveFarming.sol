// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraFarming.sol';
import './interfaces/IAlgebraIncentiveVirtualPool.sol';
import './libraries/IncentiveId.sol';
import './libraries/RewardMath.sol';
import './libraries/NFTPositionInfo.sol';
import './libraries/SafeCast.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';
import 'algebra-periphery/contracts/base/ERC721Permit.sol';

/// @title Algebra canonical staking interface
contract AlgebraIncentiveFarming is IAlgebraFarming, ERC721Permit, Multicall {
    using SafeCast for int256;
    /// @notice Represents a staking incentive
    struct Incentive {
        uint256 totalReward;
        uint256 bonusReward;
        address virtualPoolAddress;
        uint96 numberOfFarms;
        bool isPoolCreated;
        uint224 totalLiquidity;
    }

    /// @notice Represents the deposit of a liquidity NFT
    struct Deposit {
        uint256 L2TokenId;
        address owner;
        int24 tickLower;
        int24 tickUpper;
    }

    /// @notice Represents the nft layer 2
    struct L2Nft {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        uint256 tokenId;
    }

    /// @inheritdoc IAlgebraFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraFarming
    IAlgebraPoolDeployer public immutable override deployer;

    /// @inheritdoc IAlgebraFarming
    IVirtualPoolDeployer public immutable override vdeployer;

    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    /// @dev farms[tokenId][incentiveHash] => Farm
    mapping(uint256 => mapping(bytes32 => uint128)) public override farms;

    /// @dev l2Nfts[tokenId] => L2Nft
    mapping(uint256 => L2Nft) private l2Nfts;

    address private incentiveMaker;
    address private owner;

    /// @inheritdoc IAlgebraFarming
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        emit IncentiveMakerChanged(incentiveMaker, _incentiveMaker);
        incentiveMaker = _incentiveMaker;
    }

    /// @dev rewards[rewardToken][owner] => uint256
    /// @inheritdoc IAlgebraFarming
    mapping(IERC20Minimal => mapping(address => uint256)) public override rewards;

    modifier isAuthorizedForToken(uint256 tokenId) {
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

    /// @param _deployer pool deployer contract address
    /// @param _nonfungiblePositionManager the NFT position manager contract address
    /// @param _vdeployer virtual pool deployer contract address
    /// @param _maxIncentiveStartLeadTime the max duration of an incentive in seconds
    /// @param _maxIncentiveDuration the max amount of seconds into the future the incentive startTime can be set
    constructor(
        IAlgebraPoolDeployer _deployer,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IVirtualPoolDeployer _vdeployer,
        uint256 _maxIncentiveStartLeadTime,
        uint256 _maxIncentiveDuration
    ) ERC721Permit('Algebra Farming NFT-V2', 'ALGB-FARM', '2') {
        owner = msg.sender;
        deployer = _deployer;
        vdeployer = _vdeployer;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        maxIncentiveStartLeadTime = _maxIncentiveStartLeadTime;
        maxIncentiveDuration = _maxIncentiveDuration;
    }

    /// @inheritdoc IAlgebraFarming
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        address _incentive = key.pool.activeIncentive();
        uint32 _activeEndTimestamp;
        if (_incentive != address(0)) {
            _activeEndTimestamp = IAlgebraIncentiveVirtualPool(_incentive).desiredEndTimestamp();
        }

        require(
            _activeEndTimestamp < block.timestamp,
            'AlgebraFarming::createIncentive: there is already active incentive'
        );
        require(reward > 0, 'AlgebraFarming::createIncentive: reward must be positive');
        require(
            block.timestamp <= key.startTime,
            'AlgebraFarming::createIncentive: start time must be now or in the future'
        );
        require(
            key.startTime - block.timestamp <= maxIncentiveStartLeadTime,
            'AlgebraFarming::createIncentive: start time too far into future'
        );
        require(key.startTime < key.endTime, 'AlgebraFarming::createIncentive: start time must be before end time');
        require(
            key.endTime - key.startTime <= maxIncentiveDuration,
            'AlgebraFarming::createIncentive: incentive duration is too long'
        );

        bytes32 incentiveId = IncentiveId.compute(key);

        incentives[incentiveId].totalReward += reward;

        incentives[incentiveId].bonusReward += bonusReward;

        virtualPool = vdeployer.deploy(address(key.pool), address(this), uint32(key.startTime), uint32(key.endTime));
        key.pool.setIncentive(virtualPool);

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

    /// @notice Upon receiving a Algebra ERC721, creates the token deposit setting owner to `from`. Also farms token
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
            'AlgebraFarming::onERC721Received: not an Algebra nft'
        );

        (, , , , int24 tickLower, int24 tickUpper, , , , , ) = nonfungiblePositionManager.positions(tokenId);

        deposits[tokenId] = Deposit({owner: from, L2TokenId: 0, tickLower: tickLower, tickUpper: tickUpper});
        emit DepositTransferred(tokenId, address(0), from);

        if (data.length > 0) {
            require(data.length == 192, 'AlgebraFarming::onERC721Received: data is invalid');
            _enterFarming(abi.decode(data, (IncentiveKey)), tokenId);
        }
        return this.onERC721Received.selector;
    }

    /// @inheritdoc IAlgebraFarming
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data
    ) external override {
        require(to != address(this), 'AlgebraFarming::withdrawToken: cannot withdraw to farming');
        Deposit memory deposit = deposits[tokenId];
        require(deposit.L2TokenId == 0, 'AlgebraFarming::withdrawToken: cannot withdraw token while farmd');
        require(deposit.owner == msg.sender, 'AlgebraFarming::withdrawToken: only owner can withdraw token');

        delete deposits[tokenId];
        emit DepositTransferred(tokenId, deposit.owner, address(0));

        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, data);
    }

    /// @inheritdoc IAlgebraFarming
    function enterFarming(IncentiveKey memory key, uint256 tokenId) external override {
        require(deposits[tokenId].owner == msg.sender, 'AlgebraFarming::enterFarming: only owner can farm token');
        require(deposits[tokenId].L2TokenId == 0, 'AlgebraFarming::enterFarming: already farmd');
        _enterFarming(key, tokenId);
        _nextId++;
    }

    /// @inheritdoc IAlgebraFarming
    function exitFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        _exitFarming(key, tokenId);
    }

    /// @inheritdoc IAlgebraFarming
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

    /// @inheritdoc IAlgebraFarming
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        view
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        bytes32 incentiveId = IncentiveId.compute(key);

        uint128 liquidity = farms[tokenId][incentiveId];
        require(liquidity > 0, 'AlgebraFarming::getRewardInfo: farm does not exist');

        Deposit memory deposit = deposits[tokenId];
        Incentive memory incentive = incentives[incentiveId];

        (
            uint160 secondsPerLiquidityInsideX128,
            uint256 initTimestamp,
            uint256 endTimestamp
        ) = IAlgebraIncentiveVirtualPool(incentive.virtualPoolAddress).getInnerSecondsPerLiquidity(
                deposit.tickLower,
                deposit.tickUpper
            );

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

    /// @dev Farms a deposited token without doing an ownership check
    function _enterFarming(IncentiveKey memory key, uint256 tokenId) private {
        require(block.timestamp < key.startTime, 'AlgebraFarming::enterFarming: incentive has already started');

        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive');
        require(farms[tokenId][incentiveId] == 0, 'AlgebraFarming::enterFarming: token already farmed');

        (IAlgebraPool pool, int24 tickLower, int24 tickUpper, uint128 liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'AlgebraFarming::enterFarming: token pool is not the incentive pool');
        require(liquidity > 0, 'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity');

        incentives[incentiveId].numberOfFarms++;
        (, int24 tick, , , , , , ) = pool.globalState();

        IAlgebraIncentiveVirtualPool virtualPool = IAlgebraIncentiveVirtualPool(
            incentives[incentiveId].virtualPoolAddress
        );
        virtualPool.applyLiquidityDeltaToPosition(tickLower, tickUpper, int256(liquidity).toInt128(), tick);

        _mint(msg.sender, _nextId);

        deposits[tokenId].L2TokenId = _nextId;
        l2Nfts[_nextId].tokenId = tokenId;

        farms[tokenId][incentiveId] = liquidity;

        incentives[incentiveId].totalLiquidity += liquidity;

        emit FarmStarted(tokenId, _nextId, incentiveId, liquidity);
    }

    function burn(uint256 tokenId) private isAuthorizedForToken(tokenId) {
        delete l2Nfts[tokenId];
        _burn(tokenId);
    }

    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(l2Nfts[tokenId].nonce++);
    }

    /// @inheritdoc IERC721
    function getApproved(uint256 tokenId) public view override(ERC721, IERC721) returns (address) {
        require(_exists(tokenId), 'ERC721: approved query for nonexistent token');

        return l2Nfts[tokenId].operator;
    }

    /// @dev Overrides _approve to use the operator in the position, which is packed with the position permit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        l2Nfts[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function _exitFarming(IncentiveKey memory key, uint256 tokenId) private {
        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive memory incentive = incentives[incentiveId];
        // anyone can call exitFarming if the block time is after the end time of the incentive
        require(
            block.timestamp > key.endTime || block.timestamp < key.startTime,
            'AlgebraFarming::exitFarming: cannot exitFarming before end time'
        );

        uint128 liquidity = farms[tokenId][incentiveId];

        require(liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        deposits[tokenId].owner = msg.sender;
        Deposit memory deposit = deposits[tokenId];

        incentives[incentiveId].numberOfFarms--;

        uint256 reward = 0;
        uint256 bonusReward = 0;

        IAlgebraIncentiveVirtualPool virtualPool = IAlgebraIncentiveVirtualPool(
            incentives[incentiveId].virtualPoolAddress
        );

        if (block.timestamp > key.endTime) {
            (uint160 secondsPerLiquidityInsideX128, uint256 initTimestamp, uint256 endTimestamp) = virtualPool
                .getInnerSecondsPerLiquidity(deposit.tickLower, deposit.tickUpper);

            if (endTimestamp == 0) {
                virtualPool.finish(uint32(block.timestamp), uint32(key.startTime));
                (secondsPerLiquidityInsideX128, initTimestamp, endTimestamp) = virtualPool.getInnerSecondsPerLiquidity(
                    deposit.tickLower,
                    deposit.tickUpper
                );
            }

            reward = RewardMath.computeRewardAmount(
                incentive.totalReward,
                initTimestamp,
                endTimestamp,
                liquidity,
                incentive.totalLiquidity,
                secondsPerLiquidityInsideX128
            );

            rewards[key.rewardToken][deposit.owner] += reward;

            if (incentive.bonusReward != 0) {
                bonusReward = RewardMath.computeRewardAmount(
                    incentive.bonusReward,
                    initTimestamp,
                    endTimestamp,
                    liquidity,
                    incentive.totalLiquidity,
                    secondsPerLiquidityInsideX128
                );

                rewards[key.bonusRewardToken][deposit.owner] += bonusReward;
            }
        } else {
            (IAlgebraPool pool, , , ) = NFTPositionInfo.getPositionInfo(deployer, nonfungiblePositionManager, tokenId);
            (, int24 tick, , , , , , ) = pool.globalState();

            virtualPool.applyLiquidityDeltaToPosition(
                deposit.tickLower,
                deposit.tickUpper,
                -int256(liquidity).toInt128(),
                tick
            );
        }

        burn(deposit.L2TokenId);
        deposits[tokenId].L2TokenId = 0;

        delete farms[tokenId][incentiveId];

        emit FarmEnded(
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
