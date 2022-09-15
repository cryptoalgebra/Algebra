// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;
pragma abicoder v2;
import './interfaces/IFarmingCenter.sol';
import './interfaces/IFarmingCenterVault.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/IERC20Minimal.sol';

import '@cryptoalgebra/periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '@cryptoalgebra/periphery/contracts/base/Multicall.sol';
import '@cryptoalgebra/periphery/contracts/base/ERC721Permit.sol';

import './base/PeripheryPayments.sol';
import './libraries/IncentiveId.sol';

/// @title Algebra main farming contract
/// @dev Manages farmings and performs entry, exit and other actions.
contract FarmingCenter is IFarmingCenter, ERC721Permit, Multicall, PeripheryPayments {
    IAlgebraLimitFarming public immutable override limitFarming;
    IAlgebraEternalFarming public immutable override eternalFarming;
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;
    IFarmingCenterVault public immutable override farmingCenterVault;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

    /// @dev saves addresses of virtual pools for pool
    mapping(address => VirtualPoolAddresses) private _virtualPoolAddresses;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    mapping(uint256 => L2Nft) public override l2Nfts;

    /// @notice Represents the deposit of a liquidity NFT
    struct Deposit {
        uint256 L2TokenId;
        uint32 numberOfFarms;
        bool inLimitFarming;
        address owner;
    }

    /// @notice Represents the nft layer 2
    struct L2Nft {
        uint96 nonce; // the nonce for permits
        address operator; // the address that is approved for spending this token
        uint256 tokenId;
    }

    constructor(
        IAlgebraLimitFarming _limitFarming,
        IAlgebraEternalFarming _eternalFarming,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IFarmingCenterVault _farmingCenterVault
    )
        ERC721Permit('Algebra Farming NFT-V2', 'ALGB-FARM', '2')
        PeripheryPayments(INonfungiblePositionManager(_nonfungiblePositionManager).WNativeToken())
    {
        limitFarming = _limitFarming;
        eternalFarming = _eternalFarming;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        farmingCenterVault = _farmingCenterVault;
    }

    function checkAuthorizationForToken(uint256 tokenId) private view {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
    }

    /// @notice Upon receiving a Algebra ERC721, creates the token deposit setting owner to `from`.
    /// @inheritdoc IERC721Receiver
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        require(msg.sender == address(nonfungiblePositionManager), 'not an Algebra nft');

        uint256 id = _nextId;
        Deposit storage newDeposit = deposits[tokenId];
        (newDeposit.L2TokenId, newDeposit.owner) = (id, from);

        l2Nfts[id].tokenId = tokenId;

        _mint(from, id);
        _nextId = id + 1;

        emit DepositTransferred(tokenId, address(0), from);

        return this.onERC721Received.selector;
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
    ) external override {
        Deposit storage _deposit = deposits[tokenId];
        checkAuthorizationForToken(_deposit.L2TokenId);
        (uint32 numberOfFarms, bool inLimitFarming) = (_deposit.numberOfFarms, _deposit.inLimitFarming);
        numberOfFarms++;
        IAlgebraFarming _farming;
        if (isLimit) {
            require(!inLimitFarming, 'token already farmed');
            inLimitFarming = true;
            _farming = IAlgebraFarming(limitFarming);
        } else _farming = IAlgebraFarming(eternalFarming);

        (_deposit.numberOfFarms, _deposit.inLimitFarming) = (numberOfFarms, inLimitFarming);
        bytes32 incentiveId = IncentiveId.compute(key);
        (, , , , , address multiplierToken, ) = _farming.incentives(incentiveId);
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
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        bool isLimit
    ) external override {
        Deposit storage deposit = deposits[tokenId];
        checkAuthorizationForToken(deposit.L2TokenId);
        IAlgebraFarming _farming;

        deposit.numberOfFarms -= 1;
        deposit.owner = msg.sender;
        if (isLimit) {
            deposit.inLimitFarming = false;
            _farming = IAlgebraFarming(limitFarming);
        } else _farming = IAlgebraFarming(eternalFarming);

        _farming.exitFarming(key, tokenId, msg.sender);

        bytes32 incentiveId = IncentiveId.compute(key);
        (, , , , , address multiplierToken, ) = _farming.incentives(incentiveId);
        if (multiplierToken != address(0)) {
            farmingCenterVault.claimTokens(multiplierToken, msg.sender, tokenId, incentiveId);
        }
    }

    /// @inheritdoc IFarmingCenter
    function collect(INonfungiblePositionManager.CollectParams memory params)
        external
        override
        returns (uint256 amount0, uint256 amount1)
    {
        checkAuthorizationForToken(deposits[params.tokenId].L2TokenId);
        if (params.recipient == address(0)) {
            params.recipient = address(this);
        }
        return nonfungiblePositionManager.collect(params);
    }

    /// @inheritdoc IFarmingCenter
    function collectRewards(IncentiveKey memory key, uint256 tokenId)
        external
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        checkAuthorizationForToken(deposits[tokenId].L2TokenId);
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

    /// @inheritdoc IFarmingCenter
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data
    ) external override {
        require(to != address(this), 'cannot withdraw to farming');
        Deposit storage deposit = deposits[tokenId];
        uint256 l2TokenId = deposit.L2TokenId;

        checkAuthorizationForToken(l2TokenId);
        require(deposit.numberOfFarms == 0, 'cannot withdraw token while farmd');

        delete l2Nfts[l2TokenId];
        _burn(l2TokenId);
        delete deposits[tokenId];

        emit DepositTransferred(tokenId, msg.sender, address(0));
        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, data);
    }

    /**
     * @dev This function is called by the main pool when an initialized tick is crossed and two farmings are active at same time.
     * @param nextTick The crossed tick
     * @param zeroToOne The direction
     */
    function cross(int24 nextTick, bool zeroToOne) external override {
        VirtualPoolAddresses storage _virtualPoolAddressesForPool = _virtualPoolAddresses[msg.sender];

        IAlgebraVirtualPool(_virtualPoolAddressesForPool.eternalVirtualPool).cross(nextTick, zeroToOne);
        IAlgebraVirtualPool(_virtualPoolAddressesForPool.limitVirtualPool).cross(nextTick, zeroToOne);
    }

    function virtualPoolAddresses(address pool) external view override returns (address limitVP, address eternalVP) {
        (limitVP, eternalVP) = (
            _virtualPoolAddresses[pool].limitVirtualPool,
            _virtualPoolAddresses[pool].eternalVirtualPool
        );
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
}
