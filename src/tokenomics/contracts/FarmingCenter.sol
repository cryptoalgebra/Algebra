// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;
import './incentiveFarming/interfaces/IAlgebraIncentiveVirtualPool.sol';
import './eternalFarming/interfaces/IAlgebraEternalVirtualPool.sol';
import './interfaces/IFarmingCenter.sol';

import 'algebra/contracts/interfaces/IAlgebraPool.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';
import 'algebra-periphery/contracts/base/ERC721Permit.sol';

contract FarmingCenter is IFarmingCenter, ERC721Permit, Multicall {
    IAlgebraIncentiveFarming public immutable override farming;
    IAlgebraEternalFarming public immutable override eternalFarming;
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

    mapping(address => VirtualPoolAddresses) public override virtualPoolAddresses;

    /// @dev deposits[tokenId] => Deposit
    mapping(uint256 => Deposit) public override deposits;

    mapping(uint256 => L2Nft) public override l2Nfts;

    /// @notice Represents the deposit of a liquidity NFT
    struct Deposit {
        uint256 L2TokenId;
        int24 tickLower;
        int24 tickUpper;
        uint32 numberOfFarms;
        address owner;
    }

    /// @notice Represents the nft layer 2
    struct L2Nft {
        // the nonce for permits
        uint96 nonce;
        // the address that is approved for spending this token
        address operator;
        uint256 tokenId;
    }

    modifier isAuthorizedForToken(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), 'Not approved');
        _;
    }

    constructor(
        IAlgebraIncentiveFarming _farming,
        IAlgebraEternalFarming _eternalFarming,
        INonfungiblePositionManager _nonfungiblePositionManager
    ) ERC721Permit('Algebra Farming NFT-V2', 'ALGB-FARM', '2') {
        farming = _farming;
        eternalFarming = _eternalFarming;
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    modifier onlyFarming() {
        require(msg.sender == address(farming) || msg.sender == address(eternalFarming), 'only farming can call this');
        _;
    }

    /// @notice Upon receiving a Algebra ERC721, creates the token deposit setting owner to `from`. Also farms token
    /// in one or more incentives if properly formatted `data` has a length > 0.
    /// @inheritdoc IERC721Receiver
    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata //data
    ) external override returns (bytes4) {
        require(
            msg.sender == address(nonfungiblePositionManager),
            'AlgebraFarming::onERC721Received: not an Algebra nft'
        );

        (, , , , int24 tickLower, int24 tickUpper, , , , , ) = nonfungiblePositionManager.positions(tokenId);

        deposits[tokenId] = Deposit({
            L2TokenId: _nextId,
            tickLower: tickLower,
            tickUpper: tickUpper,
            numberOfFarms: 0,
            owner: from
        });

        l2Nfts[_nextId].tokenId = tokenId;

        _mint(tx.origin, _nextId);
        _nextId++;

        emit DepositTransferred(tokenId, address(0), from);

        return this.onERC721Received.selector;
    }

    function enterEternalFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        eternalFarming.enterFarming(key, tokenId);
        deposits[tokenId].numberOfFarms += 1;
    }

    function exitEternalFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        eternalFarming.exitFarming(key, tokenId, msg.sender);
        deposits[tokenId].numberOfFarms -= 1;
        deposits[tokenId].owner = msg.sender;
    }

    function enterFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        farming.enterFarming(key, tokenId);
        deposits[tokenId].numberOfFarms += 1;
    }

    function exitFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        farming.exitFarming(key, tokenId, msg.sender);
        deposits[tokenId].numberOfFarms -= 1;
        deposits[tokenId].owner = msg.sender;
    }

    function collectFees(
        INonfungiblePositionManager.CollectParams calldata params // TODO test
    )
        external
        override
        isAuthorizedForToken(deposits[params.tokenId].L2TokenId)
        returns (uint256 amount0, uint256 amount1)
    {
        return nonfungiblePositionManager.collect(params);
    }

    function collectRewards(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {
        eternalFarming.collectRewards(key, tokenId, msg.sender);
    }

    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequestedIncentive,
        uint256 amountRequestedEternal
    ) external override returns (uint256 reward) {
        if (amountRequestedIncentive != 0) {
            reward = farming.claimRewardFrom(rewardToken, msg.sender, to, amountRequestedIncentive);
        }
        if (amountRequestedEternal != 0) {
            reward += eternalFarming.claimRewardFrom(rewardToken, msg.sender, to, amountRequestedEternal);
        }
    }

    function setFarmingCenterAddress(IAlgebraPool pool, address virtualPool) external override onlyFarming {
        if (pool.activeIncentive() == address(0)) {
            pool.setIncentive(address(this));
        }

        if (msg.sender == address(eternalFarming)) {
            virtualPoolAddresses[address(pool)].eternalVirtualPool = virtualPool;
        }

        if (msg.sender == address(farming)) {
            virtualPoolAddresses[address(pool)].virtualPool = virtualPool;
        }
    }

    /// @inheritdoc IFarmingCenter
    function withdrawToken(
        uint256 tokenId,
        address to,
        bytes memory data
    ) external override isAuthorizedForToken(deposits[tokenId].L2TokenId) {
        require(to != address(this), 'AlgebraFarming::withdrawToken: cannot withdraw to farming');
        Deposit storage deposit = deposits[tokenId];

        require(deposit.numberOfFarms == 0, 'AlgebraFarming::withdrawToken: cannot withdraw token while farmd');

        burn(deposit.L2TokenId);
        delete deposits[tokenId];
        emit DepositTransferred(tokenId, msg.sender, address(0));

        nonfungiblePositionManager.safeTransferFrom(address(this), to, tokenId, data);
    }

    function processSwap() external override {
        if (virtualPoolAddresses[msg.sender].virtualPool != address(0)) {
            IAlgebraVirtualPool(virtualPoolAddresses[msg.sender].virtualPool).processSwap();
        }

        if (virtualPoolAddresses[msg.sender].eternalVirtualPool != address(0)) {
            IAlgebraVirtualPool(virtualPoolAddresses[msg.sender].eternalVirtualPool).processSwap();
        }
    }

    function cross(int24 nextTick, bool zeroForOne) external override {
        if (virtualPoolAddresses[msg.sender].virtualPool != address(0)) {
            IAlgebraVirtualPool(virtualPoolAddresses[msg.sender].virtualPool).cross(nextTick, zeroForOne);
        }

        if (virtualPoolAddresses[msg.sender].eternalVirtualPool != address(0)) {
            IAlgebraVirtualPool(virtualPoolAddresses[msg.sender].eternalVirtualPool).cross(nextTick, zeroForOne);
        }
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

    /// @dev Overrides _approve to use the operator in the position, which is packed with the position pxermit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        l2Nfts[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function increaseCumulative(uint32 blockTimestamp) external override returns (Status) {
        Status incentiveStatus;
        Status eternalStatus;
        if (virtualPoolAddresses[msg.sender].virtualPool != address(0)) {
            incentiveStatus = IAlgebraVirtualPool(virtualPoolAddresses[msg.sender].virtualPool).increaseCumulative(
                blockTimestamp
            );
        }

        if (virtualPoolAddresses[msg.sender].eternalVirtualPool != address(0)) {
            eternalStatus = IAlgebraVirtualPool(virtualPoolAddresses[msg.sender].eternalVirtualPool).increaseCumulative(
                    blockTimestamp
                );
        }

        if (eternalStatus == Status.ACTIVE || incentiveStatus == Status.ACTIVE) {
            return Status.ACTIVE;
        } else if (incentiveStatus == Status.NOT_STARTED) {
            return Status.NOT_STARTED;
        }

        return Status.NOT_EXIST;
    }
}
