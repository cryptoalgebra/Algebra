// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;
import './incentiveFarming/interfaces/IAlgebraIncentiveVirtualPool.sol';
import './eternalFarming/interfaces/IAlgebraEternalVirtualPool.sol';
import './interfaces/IFarmingCenter.sol';

import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/base/Multicall.sol';
import 'algebra-periphery/contracts/base/ERC721Permit.sol';

import './base/PeripheryPayments.sol';

contract FarmingCenter is IFarmingCenter, ERC721Permit, Multicall, PeripheryPayments {

    IAlgebraIncentiveFarming public immutable override farming;
    IAlgebraEternalFarming public immutable override eternalFarming;
    INonfungiblePositionManager public immutable override nonfungiblePositionManager;

    /// @dev The ID of the next token that will be minted. Skips 0
    uint256 private _nextId = 1;

    mapping(address => VirtualPoolAddresses) private _virtualPoolAddresses;

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
        bool inLimitFarming;
        uint256 tokensLocked;
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
    )
        ERC721Permit('Algebra Farming NFT-V2', 'ALGB-FARM', '2')
        PeripheryPayments(INonfungiblePositionManager(_nonfungiblePositionManager).WNativeToken())
    {
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
            inLimitFarming: false,
            tickLower: tickLower,
            tickUpper: tickUpper,
            numberOfFarms: 0,
            owner: from,
            tokensLocked: 0
        });

        l2Nfts[_nextId].tokenId = tokenId;

        _mint(from, _nextId);
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

    function enterFarming(IncentiveKey memory key, uint256 tokenId, uint256 tokensLocked)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {   
        Deposit storage deposit = deposits[tokenId];
        require(!deposit.inLimitFarming, "token already farmed");
        bytes32 incentiveId = keccak256(abi.encode(key));
        (, , , , , , address multiplierToken, ) = farming.incentives(incentiveId);
        farming.enterFarming(key, tokenId, tokensLocked);
        if (tokensLocked > 0) {
            TransferHelper.safeTransferFrom(multiplierToken, msg.sender, address(this), tokensLocked);
        }
        deposit.numberOfFarms += 1;
        deposit.tokensLocked = tokensLocked;
        deposit.inLimitFarming = true;
    }

    function exitFarming(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
    {   
        Deposit storage deposit = deposits[tokenId];
        farming.exitFarming(key, tokenId, msg.sender);
        deposit.numberOfFarms -= 1;
        bytes32 incentiveId = keccak256(abi.encode(key));
        (, , , , , , address multiplierToken, ) = farming.incentives(incentiveId);
        deposit.owner = msg.sender;
        deposit.inLimitFarming = false;
        if (deposit.tokensLocked > 0) {
            TransferHelper.safeTransfer(multiplierToken, msg.sender, deposit.tokensLocked);
            deposit.tokensLocked = 0;
        }
    }

    function collect(INonfungiblePositionManager.CollectParams memory params)
        external
        override
        isAuthorizedForToken(deposits[params.tokenId].L2TokenId)
        returns (uint256 amount0, uint256 amount1)
    {
        if (params.recipient == address(0)) {
            params.recipient = address(this);
        }
        return nonfungiblePositionManager.collect(params);
    }

    function collectRewards(IncentiveKey memory key, uint256 tokenId)
        external
        override
        isAuthorizedForToken(deposits[tokenId].L2TokenId)
        returns (uint256 reward, uint256 bonusReward)
    {
        address _virtualPool = _virtualPoolAddresses[address(key.pool)].eternalVirtualPool;
        if (_virtualPool != address(0)) {
            IAlgebraVirtualPool(_virtualPool).increaseCumulative(uint32(block.timestamp));
        }
        (reward, bonusReward) = eternalFarming.collectRewards(key, tokenId, msg.sender);
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
            // turn on pool directly
            pool.setIncentive(virtualPool);
        } else {
            if (virtualPool != address(0)) {
                // turn on proxy
                pool.setIncentive(address(this));
            } else {
                // turn off proxy
                if (msg.sender == address(farming)) {
                    if (_virtualPoolAddresses[address(pool)].eternalVirtualPool != address(0)) {
                        pool.setIncentive(_virtualPoolAddresses[address(pool)].eternalVirtualPool);
                    } else {
                        pool.setIncentive(address(0)); // turn off completely
                    }
                } else {
                    if (_virtualPoolAddresses[address(pool)].hasIncentive) {
                        pool.setIncentive(_virtualPoolAddresses[address(pool)].virtualPool);
                    } else {
                        pool.setIncentive(address(0)); // turn off completely
                    }
                }
            }
        }

        if (msg.sender == address(eternalFarming)) {
            _virtualPoolAddresses[address(pool)].eternalVirtualPool = virtualPool;
        } else if (msg.sender == address(farming)) {
            _virtualPoolAddresses[address(pool)].hasIncentive = virtualPool != address(0);
            _virtualPoolAddresses[address(pool)].virtualPool = virtualPool;
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
        IAlgebraVirtualPool(_virtualPoolAddresses[msg.sender].eternalVirtualPool).processSwap();

        IAlgebraVirtualPool(_virtualPoolAddresses[msg.sender].virtualPool).processSwap();
    }

    function cross(int24 nextTick, bool zeroForOne) external override {
        IAlgebraVirtualPool(_virtualPoolAddresses[msg.sender].eternalVirtualPool).cross(nextTick, zeroForOne);

        IAlgebraVirtualPool(_virtualPoolAddresses[msg.sender].virtualPool).cross(nextTick, zeroForOne);
    }

    function burn(uint256 tokenId) private isAuthorizedForToken(tokenId) {
        delete l2Nfts[tokenId];
        _burn(tokenId);
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

    /// @dev Overrides _approve to use the operator in the position, which is packed with the position pxermit nonce
    function _approve(address to, uint256 tokenId) internal override(ERC721) {
        l2Nfts[tokenId].operator = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function increaseCumulative(uint32 blockTimestamp) external override returns (Status) {
        
        Status eternalStatus = IAlgebraVirtualPool(_virtualPoolAddresses[msg.sender].eternalVirtualPool)
            .increaseCumulative(blockTimestamp);

        Status incentiveStatus = IAlgebraVirtualPool(_virtualPoolAddresses[msg.sender].virtualPool).increaseCumulative(
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
