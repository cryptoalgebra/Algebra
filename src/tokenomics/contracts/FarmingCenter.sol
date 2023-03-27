// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;
pragma abicoder v2;
import './interfaces/IFarmingCenter.sol';
import './interfaces/IFarmingCenterVault.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';
import '@cryptoalgebra/periphery/contracts/interfaces/IPositionFollower.sol';

import './interfaces/INonfungiblePositionManager.sol';

import './base/Multicall.sol';
import './base/PeripheryPayments.sol';
import './libraries/IncentiveId.sol';

/// @title Algebra main farming contract
/// @dev Manages farmings and performs entry, exit and other actions.
contract FarmingCenter is IFarmingCenter, IPositionFollower, Multicall, PeripheryPayments {
    IAlgebraLimitFarming public immutable override limitFarming;
    IAlgebraEternalFarming public immutable override eternalFarming;
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;
    IFarmingCenterVault public immutable override farmingCenterVault;

    /// @dev saves addresses of virtual pools for pool
    mapping(address => VirtualPoolAddresses) private _virtualPoolAddresses;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    mapping(bytes32 => IncentiveKey) public incentiveKeys;

    /// @notice Represents the deposit of a liquidity NFT
    struct Deposit {
        uint32 numberOfFarms;
        bytes32 limitIncentiveId;
        bytes32 eternalIncentiveId;
    }

    constructor(
        IAlgebraLimitFarming _limitFarming,
        IAlgebraEternalFarming _eternalFarming,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IFarmingCenterVault _farmingCenterVault
    ) PeripheryPayments(INonfungiblePositionManager(_nonfungiblePositionManager).WNativeToken()) {
        limitFarming = _limitFarming;
        eternalFarming = _eternalFarming;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        farmingCenterVault = _farmingCenterVault;
    }

    modifier isOwner(uint256 tokenId) {
        require(nonfungiblePositionManager.ownerOf(tokenId) == msg.sender, 'not owner');
        _;
    }

    function _getTokenBalanceOfVault(address token) private view returns (uint256 balance) {
        return IERC20Minimal(token).balanceOf(address(farmingCenterVault));
    }

    /// @inheritdoc IFarmingCenter
    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked,
        bool isLimit
    ) external override isOwner(tokenId) {
        Deposit storage _deposit = deposits[tokenId];
        bytes32 incentiveId = IncentiveId.compute(key);
        if (address(incentiveKeys[incentiveId].pool) == address(0)) {
            incentiveKeys[incentiveId] = key;
        }
        if (_deposit.numberOfFarms == 0) {
            nonfungiblePositionManager.switchFarmingStatus(tokenId, true);
        }
        _deposit.numberOfFarms += 1;
        IAlgebraFarming _farming;
        if (isLimit) {
            require(_deposit.limitIncentiveId == bytes32(0), 'token already farmed');
            _deposit.limitIncentiveId = incentiveId;
            _farming = IAlgebraFarming(limitFarming);
        } else {
            require(_deposit.eternalIncentiveId == bytes32(0), 'token already farmed');
            _deposit.eternalIncentiveId = incentiveId;
            _farming = IAlgebraFarming(eternalFarming);
        }
        (, , , , , address multiplierToken, , ) = _farming.incentives(incentiveId);
        if (tokensLocked > 0) {
            uint256 balanceBefore = _getTokenBalanceOfVault(multiplierToken);
            TransferHelper.safeTransferFrom(multiplierToken, msg.sender, address(farmingCenterVault), tokensLocked);
            uint256 balanceAfter = _getTokenBalanceOfVault(multiplierToken);
            require(balanceAfter > balanceBefore, 'Insufficient tokens locked');
            tokensLocked = balanceAfter - balanceBefore;
            farmingCenterVault.lockTokens(tokenId, incentiveId, tokensLocked);
        }

        _farming.enterFarming(key, tokenId, tokensLocked);
    }

    /// @inheritdoc IFarmingCenter
    function exitFarming(IncentiveKey memory key, uint256 tokenId, bool isLimit) external override isOwner(tokenId) {
        _exitFarming(key, tokenId, isLimit);
    }

    function _exitFarming(IncentiveKey memory key, uint256 tokenId, bool isLimit) private {
        Deposit storage deposit = deposits[tokenId];
        IAlgebraFarming _farming;

        deposit.numberOfFarms -= 1;
        if (deposit.numberOfFarms == 0) {
            nonfungiblePositionManager.switchFarmingStatus(tokenId, false);
        }
        bytes32 incentiveId = IncentiveId.compute(key);
        if (isLimit) {
            require(deposit.limitIncentiveId == incentiveId, 'invalid incentiveId');
            deposit.limitIncentiveId = bytes32(0);
            _farming = IAlgebraFarming(limitFarming);
        } else {
            require(deposit.eternalIncentiveId == incentiveId, 'invalid incentiveId');
            deposit.eternalIncentiveId = bytes32(0);
            _farming = IAlgebraFarming(eternalFarming);
        }

        _farming.exitFarming(key, tokenId, msg.sender);

        (, , , , , address multiplierToken, , ) = _farming.incentives(incentiveId);
        if (multiplierToken != address(0)) {
            farmingCenterVault.claimTokens(multiplierToken, msg.sender, tokenId, incentiveId);
        }
    }

    /// @inheritdoc IPositionFollower
    function increaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external override {
        require(msg.sender == address(nonfungiblePositionManager), 'only nonfungiblePosManager');
        Deposit storage deposit = deposits[tokenId];

        if (deposit.eternalIncentiveId != bytes32(0)) {
            // get locked token amount
            bytes32 incentiveId = deposit.eternalIncentiveId;
            uint256 lockedAmount = farmingCenterVault.balances(tokenId, incentiveId);

            // exit & enter
            IncentiveKey memory key = incentiveKeys[incentiveId];
            eternalFarming.exitFarming(key, tokenId, nonfungiblePositionManager.ownerOf(tokenId));
            eternalFarming.enterFarming(key, tokenId, lockedAmount);
        }
    }

    /// @inheritdoc IPositionFollower
    function decreaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external override {
        require(msg.sender == address(nonfungiblePositionManager), 'only nonfungiblePosManager');
        Deposit storage deposit = deposits[tokenId];

        require(deposit.limitIncentiveId == bytes32(0), 'position locked in farm');

        if (deposit.eternalIncentiveId != bytes32(0)) {
            // get locked token amount
            bytes32 incentiveId = deposit.eternalIncentiveId;
            uint256 lockedAmount = farmingCenterVault.balances(tokenId, incentiveId);

            // exit & enter
            IncentiveKey memory key = incentiveKeys[incentiveId];
            eternalFarming.exitFarming(key, tokenId, nonfungiblePositionManager.ownerOf(tokenId));
            eternalFarming.enterFarming(key, tokenId, lockedAmount);
        }
    }

    /// @inheritdoc IPositionFollower
    function burnPosition(uint256 tokenId) external override {
        require(msg.sender == address(nonfungiblePositionManager), 'only nonfungiblePosManager');
        Deposit storage deposit = deposits[tokenId];
        require(deposit.limitIncentiveId == bytes32(0), 'position locked in farm');

        if (deposit.eternalIncentiveId != bytes32(0)) {
            bytes32 incentiveId = deposit.eternalIncentiveId;
            IncentiveKey memory key = incentiveKeys[incentiveId];
            _exitFarming(key, tokenId, false);
        }
    }

    /// @inheritdoc IFarmingCenter
    function collectRewards(
        IncentiveKey memory key,
        uint256 tokenId
    ) external override isOwner(tokenId) returns (uint256 reward, uint256 bonusReward) {
        (reward, bonusReward) = eternalFarming.collectRewards(key, tokenId, msg.sender);
    }

    function _claimRewardFromFarming(
        IAlgebraFarming _farming,
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequested
    ) internal returns (uint256 reward) {
        return _farming.claimRewardFrom(rewardToken, msg.sender, to, amountRequested);
    }

    /// @inheritdoc IFarmingCenter
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequestedIncentive,
        uint256 amountRequestedEternal
    ) external override returns (uint256 reward) {
        if (amountRequestedIncentive != 0) {
            reward = _claimRewardFromFarming(limitFarming, rewardToken, to, amountRequestedIncentive);
        }
        if (amountRequestedEternal != 0) {
            reward += _claimRewardFromFarming(eternalFarming, rewardToken, to, amountRequestedEternal);
        }
    }

    /// @inheritdoc IFarmingCenter
    function connectVirtualPool(IAlgebraPool pool, address newVirtualPool) external override {
        bool isLimitFarming = msg.sender == address(limitFarming);
        require(isLimitFarming || msg.sender == address(eternalFarming), 'only farming can call this');

        VirtualPoolAddresses storage virtualPools = _virtualPoolAddresses[address(pool)];
        address newIncentive;
        if (pool.activeIncentive() == address(0)) {
            newIncentive = newVirtualPool; // turn on pool directly
        } else {
            if (newVirtualPool == address(0)) {
                // turn on directly another pool if it exists
                newIncentive = isLimitFarming ? virtualPools.eternalVirtualPool : virtualPools.limitVirtualPool;
            } else {
                newIncentive = address(this); // turn on via "proxy"
            }
        }

        pool.setIncentive(newIncentive);

        if (isLimitFarming) {
            virtualPools.limitVirtualPool = newVirtualPool;
        } else {
            virtualPools.eternalVirtualPool = newVirtualPool;
        }
    }

    /**
     * @dev This function is called by the main pool when an initialized tick is crossed and two farmings are active at same time.
     * @param nextTick The crossed tick
     * @param zeroToOne The direction
     */
    function cross(int24 nextTick, bool zeroToOne) external override returns (bool) {
        VirtualPoolAddresses storage _virtualPoolAddressesForPool = _virtualPoolAddresses[msg.sender];

        IAlgebraVirtualPool(_virtualPoolAddressesForPool.eternalVirtualPool).cross(nextTick, zeroToOne);
        IAlgebraVirtualPool(_virtualPoolAddressesForPool.limitVirtualPool).cross(nextTick, zeroToOne);
        // TODO handle "false" from virtual pool?
        return true;
    }

    function virtualPoolAddresses(address pool) external view override returns (address limitVP, address eternalVP) {
        (limitVP, eternalVP) = (
            _virtualPoolAddresses[pool].limitVirtualPool,
            _virtualPoolAddresses[pool].eternalVirtualPool
        );
    }
}
