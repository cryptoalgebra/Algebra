// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;
pragma abicoder v2;
import './farmings/incentiveFarming/interfaces/IAlgebraIncentiveVirtualPool.sol';
import './farmings/eternalFarming/interfaces/IAlgebraEternalVirtualPool.sol';
import './interfaces/IFarmingCenter.sol';
import './interfaces/IFarmingCenterVault.sol';

import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';
import 'algebra-periphery/contracts/base/ERC721Permit.sol';

import './base/PeripheryPayments.sol';
import './libraries/IncentiveId.sol';

contract FarmingCenter is IFarmingCenter, ERC721Permit, Multicall, PeripheryPayments {
    IAlgebraIncentiveFarming public immutable override farming;
    IAlgebraEternalFarming public immutable override eternalFarming;
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;
    IFarmingCenterVault public immutable override farmingCenterVault;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

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
        IAlgebraIncentiveFarming _farming,
        IAlgebraEternalFarming _eternalFarming,
        INonfungiblePositionManager _nonfungiblePositionManager,
        IFarmingCenterVault _farmingCenterVault
    )
        ERC721Permit('Algebra Farming NFT-V2', 'ALGB-FARM', '2')
        PeripheryPayments(INonfungiblePositionManager(_nonfungiblePositionManager).WNativeToken())
    {
        farming = _farming;
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
        require(
            msg.sender == address(nonfungiblePositionManager),
            'AlgebraFarming::onERC721Received: not an Algebra nft'
        );

        uint256 id = _nextId;
        Deposit storage newDeposit = deposits[tokenId];
        (newDeposit.L2TokenId, newDeposit.owner) = (id, from);

        l2Nfts[id].tokenId = tokenId;

        _mint(from, id);
        _nextId = id + 1;

        emit DepositTransferred(tokenId, address(0), from);

        return this.onERC721Received.selector;
    }

    function _enterFarming(
        IAlgebraFarming _farming,
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked,
        bool isLimit
    ) private {
        Deposit storage _deposit = deposits[tokenId];
        checkAuthorizationForToken(_deposit.L2TokenId);
        (uint32 numberOfFarms, bool inLimitFarming) = (_deposit.numberOfFarms, _deposit.inLimitFarming);
        numberOfFarms++;
        if (isLimit) {
            require(!inLimitFarming, 'token already farmed');
            inLimitFarming = true;
        }

        (_deposit.numberOfFarms, _deposit.inLimitFarming) = (numberOfFarms, inLimitFarming);
        (, , , , , , address multiplierToken, ) = _farming.incentives(IncentiveId.compute(key));
        if (tokensLocked > 0) {
            TransferHelper.safeTransferFrom(multiplierToken, msg.sender, address(farmingCenterVault), tokensLocked);
        }

        _farming.enterFarming(key, tokenId, tokensLocked);
    }

    function enterEternalFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external override {
        _enterFarming(eternalFarming, key, tokenId, tokensLocked, false);
    }

    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external override {
        _enterFarming(farming, key, tokenId, tokensLocked, true);
    }

    function _exitFarming(
        IAlgebraFarming _farming,
        IncentiveKey memory key,
        uint256 tokenId,
        bool isLimit
    ) private {
        Deposit storage deposit = deposits[tokenId];
        checkAuthorizationForToken(deposit.L2TokenId);
        deposit.numberOfFarms -= 1;
        deposit.owner = msg.sender;
        if (isLimit) {
            deposit.inLimitFarming = false;
        }

        _farming.exitFarming(key, tokenId, msg.sender);

        bytes32 incentiveId = IncentiveId.compute(key);
        (, , , , , , address multiplierToken, ) = _farming.incentives(incentiveId);
        if (multiplierToken != address(0)) {
            farmingCenterVault.claimTokens(multiplierToken, msg.sender, tokenId, incentiveId);
        }
    }

    function exitEternalFarming(IncentiveKey memory key, uint256 tokenId) external override {
        _exitFarming(eternalFarming, key, tokenId, false);
    }

    function exitFarming(IncentiveKey memory key, uint256 tokenId) external override {
        _exitFarming(farming, key, tokenId, true);
    }

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

    function collectRewards(IncentiveKey memory key, uint256 tokenId)
        external
        override
        returns (uint256 reward, uint256 bonusReward)
    {
        checkAuthorizationForToken(deposits[tokenId].L2TokenId);
        address _virtualPool = _virtualPoolAddresses[address(key.pool)].eternalVirtualPool;
        if (_virtualPool != address(0)) {
            IAlgebraVirtualPool(_virtualPool).increaseCumulative(uint32(block.timestamp));
        }
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

    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequestedIncentive,
        uint256 amountRequestedEternal
    ) external override returns (uint256 reward) {
        if (amountRequestedIncentive != 0) {
            reward = _claimRewardFromFarming(farming, rewardToken, to, amountRequestedIncentive);
        }
        if (amountRequestedEternal != 0) {
            reward += _claimRewardFromFarming(eternalFarming, rewardToken, to, amountRequestedEternal);
        }
    }

    /// @inheritdoc IFarmingCenter
    function connectVirtualPool(IAlgebraPool pool, address newVirtualPool) external override {
        bool isIncentiveFarming = msg.sender == address(farming);
        require(isIncentiveFarming || msg.sender == address(eternalFarming), 'only farming can call this');

        VirtualPoolAddresses storage virtualPools = _virtualPoolAddresses[address(pool)];
        address newIncentive;
        if (pool.activeIncentive() == address(0)) {
            newIncentive = newVirtualPool; // turn on pool directly
        } else {
            if (newVirtualPool == address(0)) {
                // turn on directly another pool if it exists
                newIncentive = isIncentiveFarming ? virtualPools.eternalVirtualPool : virtualPools.virtualPool;
            } else {
                newIncentive = address(this); // turn on via "proxy"
            }
        }

        pool.setIncentive(newIncentive);

        if (isIncentiveFarming) {
            virtualPools.virtualPool = newVirtualPool;
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
        require(to != address(this), 'AlgebraFarming::withdrawToken: cannot withdraw to farming');
        Deposit storage deposit = deposits[tokenId];
        checkAuthorizationForToken(deposit.L2TokenId);

        require(deposit.numberOfFarms == 0, 'AlgebraFarming::withdrawToken: cannot withdraw token while farmd');

        burn(deposit.L2TokenId);
        delete deposits[tokenId];
        emit DepositTransferred(tokenId, msg.sender, address(0));

        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, data);
    }

    function burn(uint256 tokenId) private {
        checkAuthorizationForToken(tokenId);
        delete l2Nfts[tokenId];
        _burn(tokenId);
    }

    function cross(int24 nextTick, bool zeroToOne) external override {
        VirtualPoolAddresses storage _virtualPoolAddressesForPool = _virtualPoolAddresses[msg.sender];

        IAlgebraVirtualPool(_virtualPoolAddressesForPool.eternalVirtualPool).cross(nextTick, zeroToOne);
        IAlgebraVirtualPool(_virtualPoolAddressesForPool.virtualPool).cross(nextTick, zeroToOne);
    }

    function _getAndIncrementNonce(uint256 tokenId) internal override returns (uint256) {
        return uint256(l2Nfts[tokenId].nonce++);
    }

    function virtualPoolAddresses(address pool) public view override returns (address incentiveVP, address eternalVP) {
        (incentiveVP, eternalVP) = (
            _virtualPoolAddresses[pool].virtualPool,
            _virtualPoolAddresses[pool].eternalVirtualPool
        );
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

    function increaseCumulative(uint32 blockTimestamp) external override returns (Status) {
        VirtualPoolAddresses storage _virtualPoolAddressesForPool = _virtualPoolAddresses[msg.sender];
        Status eternalStatus = IAlgebraVirtualPool(_virtualPoolAddressesForPool.eternalVirtualPool).increaseCumulative(
            blockTimestamp
        );

        Status incentiveStatus = IAlgebraVirtualPool(_virtualPoolAddressesForPool.virtualPool).increaseCumulative(
            blockTimestamp
        );

        if (eternalStatus == Status.ACTIVE || incentiveStatus == Status.ACTIVE) {
            return Status.ACTIVE;
        } else if (incentiveStatus == Status.NOT_STARTED) {
            return Status.NOT_STARTED;
        }

        return Status.NOT_EXIST;
    }
}
