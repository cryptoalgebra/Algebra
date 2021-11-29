// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraEternalFarming.sol';
import '../interfaces/IAlgebraEternalVirtualPool.sol';
import '../libraries/IncentiveId.sol';
import '../libraries/RewardMath.sol';
import '../libraries/NFTPositionInfo.sol';
import '../libraries/SafeCast.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';
import 'algebra/contracts/libraries/FullMath.sol';
import 'algebra/contracts/libraries/Constants.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';
import 'algebra-periphery/contracts/base/ERC721Permit.sol';

/// @title Algebra canonical staking interface
contract AlgebraEternalFarming is IAlgebraEternalFarming, ERC721Permit, Multicall {
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

    /// @inheritdoc IAlgebraEternalFarming
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @inheritdoc IAlgebraEternalFarming
    IAlgebraPoolDeployer public immutable override deployer;

    /// @inheritdoc IAlgebraEternalFarming
    IVirtualPoolDeployer public immutable override vdeployer;

    /// @inheritdoc IAlgebraEternalFarming
    uint256 public immutable override maxIncentiveStartLeadTime;
    /// @inheritdoc IAlgebraEternalFarming
    uint256 public immutable override maxIncentiveDuration;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

    /// @dev bytes32 refers to the return value of IncentiveId.compute
    mapping(bytes32 => Incentive) public override incentives;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    /// @notice Represents the farm for nft
    struct Farm {
        uint128 liquidity;
        // the address that is approved for spending this token
        uint256 innerRewardGrowth0;
        uint256 innerRewardGrowth1;
    }
    /// @dev farms[tokenId][incentiveHash] => Farm
    mapping(uint256 => mapping(bytes32 => Farm)) public override farms;

    /// @dev l2Nfts[tokenId] => L2Nft
    mapping(uint256 => L2Nft) private l2Nfts;

    address private incentiveMaker;
    address private owner;

    // @inheritdoc IAlgebraPoolDeployer
    function setIncentiveMaker(address _incentiveMaker) external override onlyOwner {
        incentiveMaker = _incentiveMaker;
    }

    /// @dev rewards[rewardToken][owner] => uint256
    /// @inheritdoc IAlgebraEternalFarming
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

    /// @inheritdoc IAlgebraEternalFarming
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        uint128 rewardRate,
        uint128 bonusRewardRate
    ) external override onlyIncentiveMaker returns (address virtualPool) {
        address _incentive = key.pool.activeIncentive();
        uint32 _activeEndTimestamp;
        require(_incentive == address(0), 'Farming already exists');

        bytes32 incentiveId = IncentiveId.compute(key);

        incentives[incentiveId].totalReward += reward;

        incentives[incentiveId].bonusReward += bonusReward;

        virtualPool = vdeployer.deploy(address(key.pool), address(this), 0, 0);
        key.pool.setIncentive(virtualPool);

        incentives[incentiveId].isPoolCreated = true;
        incentives[incentiveId].virtualPoolAddress = address(virtualPool);

        TransferHelper.safeTransferFrom(address(key.bonusRewardToken), msg.sender, address(this), bonusReward);

        TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), reward);

        IAlgebraEternalVirtualPool(virtualPool).addRewards(reward, bonusReward);
        IAlgebraEternalVirtualPool(virtualPool).setRates(rewardRate, bonusRewardRate);

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

    function addRewards(
        IncentiveKey memory key,
        uint256 rewardAmount,
        uint256 bonusRewardAmount
    ) external override {
        bytes32 incentiveId = IncentiveId.compute(key);
        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive');

        if (rewardAmount > 0) {
            uint256 balanceBefore = key.rewardToken.balanceOf(address(this));
            TransferHelper.safeTransferFrom(address(key.rewardToken), msg.sender, address(this), rewardAmount);
            uint256 balanceAfter;
            require((balanceAfter = key.rewardToken.balanceOf(address(this))) >= balanceBefore);
            rewardAmount = balanceAfter - balanceBefore;
        }

        if (bonusRewardAmount > 0) {
            uint256 balanceBefore = key.bonusRewardToken.balanceOf(address(this));
            TransferHelper.safeTransferFrom(
                address(key.bonusRewardToken),
                msg.sender,
                address(this),
                bonusRewardAmount
            );
            uint256 balanceAfter;
            require((balanceAfter = key.bonusRewardToken.balanceOf(address(this))) >= balanceBefore);
            bonusRewardAmount = balanceAfter - balanceBefore;
        }

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);

        virtualPool.addRewards(rewardAmount, bonusRewardAmount);
    }

    function setRates(
        IncentiveKey memory key,
        uint128 rewardRate,
        uint128 bonusRewardRate
    ) external override onlyIncentiveMaker {
        bytes32 incentiveId = IncentiveId.compute(key);
        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);
        virtualPool.setRates(rewardRate, bonusRewardRate);
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

    /// @inheritdoc IAlgebraEternalFarming
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

    /// @inheritdoc IAlgebraEternalFarming
    function enterFarming(IncentiveKey memory key, uint256 tokenId) external override {
        require(deposits[tokenId].owner == msg.sender, 'AlgebraFarming::enterFarming: only owner can farm token');
        require(deposits[tokenId].L2TokenId == 0, 'AlgebraFarming::enterFarming: already farmd');
        _enterFarming(key, tokenId);
        _nextId++;
    }

    /// @inheritdoc IAlgebraEternalFarming
    function exitFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        _exitFarming(key, tokenId);
    }

    /// @inheritdoc IAlgebraEternalFarming
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

    /// @inheritdoc IAlgebraEternalFarming
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        view
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        bytes32 incentiveId = IncentiveId.compute(key);

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity > 0, 'AlgebraFarming::getRewardInfo: farm does not exist');

        Deposit memory deposit = deposits[tokenId];
        Incentive memory incentive = incentives[incentiveId];

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            deposit.tickLower,
            deposit.tickUpper
        );

        (reward, bonusReward) = (
            FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128),
            FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128)
        );
    }

    function collectRewards(IncentiveKey memory key, uint256 tokenId) external override {
        Deposit memory deposit = deposits[tokenId];
        require(deposit.owner == msg.sender, 'AlgebraFarming::collect: only owner can collect rewards');

        bytes32 incentiveId = IncentiveId.compute(key);
        Incentive memory incentive = incentives[incentiveId];
        require(incentive.totalReward > 0, 'AlgebraFarming::collect: non-existent incentive');

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentive.virtualPoolAddress);

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            deposit.tickLower,
            deposit.tickUpper
        );

        Farm memory farm = farms[tokenId][incentiveId];
        require(farm.liquidity != 0, 'AlgebraFarming::collect: farm does not exist');

        (uint128 reward, uint128 bonusReward) = (
            uint128(FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128)),
            uint128(FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128))
        );

        farms[tokenId][incentiveId].innerRewardGrowth0 = innerRewardGrowth0;
        farms[tokenId][incentiveId].innerRewardGrowth1 = innerRewardGrowth1;

        if (reward != 0) {
            rewards[key.rewardToken][deposit.owner] += reward;
        }
        if (bonusReward != 0) {
            rewards[key.bonusRewardToken][deposit.owner] += bonusReward;
        }
    }

    /// @dev Farms a deposited token without doing an ownership check
    function _enterFarming(IncentiveKey memory key, uint256 tokenId) private {
        bytes32 incentiveId = IncentiveId.compute(key);

        require(incentives[incentiveId].totalReward > 0, 'AlgebraFarming::enterFarming: non-existent incentive');
        require(farms[tokenId][incentiveId].liquidity == 0, 'AlgebraFarming::enterFarming: token already farmed');

        (IAlgebraPool pool, int24 tickLower, int24 tickUpper, uint128 liquidity) = NFTPositionInfo.getPositionInfo(
            deployer,
            nonfungiblePositionManager,
            tokenId
        );

        require(pool == key.pool, 'AlgebraFarming::enterFarming: token pool is not the incentive pool');
        require(liquidity > 0, 'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity');

        incentives[incentiveId].numberOfFarms++;
        (, int24 tick, , , , , , ) = pool.globalState();

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);
        virtualPool.applyLiquidityDeltaToPosition(
            uint32(block.timestamp),
            tickLower,
            tickUpper,
            int256(liquidity).toInt128(),
            tick
        );

        _mint(msg.sender, _nextId);

        deposits[tokenId].L2TokenId = _nextId;
        l2Nfts[_nextId].tokenId = tokenId;

        (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
            tickLower,
            tickUpper
        );

        farms[tokenId][incentiveId] = Farm({
            liquidity: liquidity,
            innerRewardGrowth0: innerRewardGrowth0,
            innerRewardGrowth1: innerRewardGrowth1
        });

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

        Farm memory farm = farms[tokenId][incentiveId];

        require(farm.liquidity != 0, 'AlgebraFarming::exitFarming: farm does not exist');

        deposits[tokenId].owner = msg.sender;
        Deposit memory deposit = deposits[tokenId];

        incentives[incentiveId].numberOfFarms--;

        uint256 reward = 0;
        uint256 bonusReward = 0;

        IAlgebraEternalVirtualPool virtualPool = IAlgebraEternalVirtualPool(incentives[incentiveId].virtualPoolAddress);

        {
            (IAlgebraPool pool, , , ) = NFTPositionInfo.getPositionInfo(deployer, nonfungiblePositionManager, tokenId);
            (, int24 tick, , , , , , ) = pool.globalState();

            virtualPool.applyLiquidityDeltaToPosition(
                uint32(block.timestamp),
                deposit.tickLower,
                deposit.tickUpper,
                0,
                tick
            );

            (uint256 innerRewardGrowth0, uint256 innerRewardGrowth1) = virtualPool.getInnerRewardsGrowth(
                deposit.tickLower,
                deposit.tickUpper
            );

            virtualPool.applyLiquidityDeltaToPosition(
                uint32(block.timestamp),
                deposit.tickLower,
                deposit.tickUpper,
                -int128(farm.liquidity),
                tick
            );

            (reward, bonusReward) = (
                uint128(FullMath.mulDiv(innerRewardGrowth0 - farm.innerRewardGrowth0, farm.liquidity, Constants.Q128)),
                uint128(FullMath.mulDiv(innerRewardGrowth1 - farm.innerRewardGrowth1, farm.liquidity, Constants.Q128))
            );
        }

        if (reward != 0) {
            rewards[key.rewardToken][deposit.owner] += reward;
        }
        if (bonusReward != 0) {
            rewards[key.bonusRewardToken][deposit.owner] += bonusReward;
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
