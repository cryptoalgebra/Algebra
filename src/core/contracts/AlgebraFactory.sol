// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IAlgebraPoolDeployer.sol';
import './interfaces/IDataStorageOperator.sol';

import './libraries/AdaptiveFee.sol';
import './DataStorageOperator.sol';

/**
 * @title Algebra factory
 * @notice Is used to deploy pools and its dataStorages
 */
contract AlgebraFactory is IAlgebraFactory {
    /// @inheritdoc IAlgebraFactory
    address public override owner;

    // @inheritdoc IAlgebraFactory
    address public override poolDeployer;

    // @inheritdoc IAlgebraFactory
    address public override farmingAddress;

    // @inheritdoc IAlgebraFactory
    address public override vaultAddress;

    AdaptiveFee.Configuration public baseFeeConfiguration =
        AdaptiveFee.Configuration(
            3000 - 500, // alpha1
            10000 - 3000, // alpha2
            180, // beta1
            1500, // beta2
            30, // gamma1
            100, // gamma2
            0, // volumeBeta
            10, // volumeGamma
            Constants.BASE_FEE // baseFee
        );

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    // @inheritdoc IAlgebraFactory
    mapping(address => mapping(address => address)) public override poolByPair;

    constructor(address _poolDeployer, address _vaultAddress) {
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);

        poolDeployer = _poolDeployer;
        vaultAddress = _vaultAddress;
    }

    // @inheritdoc IAlgebraFactory
    function createPool(address tokenA, address tokenB) external override returns (address pool) {
        require(tokenA != tokenB);
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0));
        require(poolByPair[token0][token1] == address(0));

        IDataStorageOperator dataStorage = IDataStorageOperator(
            address(new DataStorageOperator(computeAddress(token0, token1)))
        );

        AdaptiveFee.Configuration memory _feeConfiguration = baseFeeConfiguration;

        dataStorage.changeFeeConfiguration(
            _feeConfiguration.alpha1,
            _feeConfiguration.alpha2,
            _feeConfiguration.beta1,
            _feeConfiguration.beta2,
            _feeConfiguration.gamma1,
            _feeConfiguration.gamma2,
            _feeConfiguration.volumeBeta,
            _feeConfiguration.volumeGamma,
            _feeConfiguration.baseFee
        );

        pool = IAlgebraPoolDeployer(poolDeployer).deploy(address(dataStorage), address(this), token0, token1);

        poolByPair[token0][token1] = pool;
        // to avoid future addresses comparing we are populating the mapping twice
        poolByPair[token1][token0] = pool;
        emit PoolCreated(token0, token1, pool);
    }

    // @inheritdoc IAlgebraFactory
    function setOwner(address _owner) external override onlyOwner {
        emit OwnerChanged(owner, _owner);
        owner = _owner;
    }

    // @inheritdoc IAlgebraFactory
    function setFarmingAddress(address _farmingAddress) external override onlyOwner {
        farmingAddress = _farmingAddress;
    }

    // @inheritdoc IAlgebraFactory
    function setVaultAddress(address _vaultAddres) external override onlyOwner {
        vaultAddress = _vaultAddres;
    }

    // @inheritdoc IAlgebraFactory
    function setBaseFeeConfiguration(
        uint32 alpha1,
        uint32 alpha2,
        uint32 beta1,
        uint32 beta2,
        uint16 gamma1,
        uint16 gamma2,
        uint32 volumeBeta,
        uint32 volumeGamma,
        uint16 baseFee
    ) external override onlyOwner {
        baseFeeConfiguration = AdaptiveFee.Configuration(
            alpha1,
            alpha2,
            beta1,
            beta2,
            gamma1,
            gamma2,
            volumeBeta,
            volumeGamma,
            baseFee
        );
    }

    bytes32 internal constant POOL_INIT_CODE_HASH = 0xbe64af87c62fc66a06a6fe1770f612d132c938ee3c6930a7934eb9336d865b12;

    /// @notice Deterministically computes the pool address given the factory and PoolKey
    /// @param token0 first token
    /// @param token1 second token
    /// @return pool The contract address of the V3 pool
    function computeAddress(address token0, address token1) internal view returns (address pool) {
        pool = address(
            uint256(
                keccak256(
                    abi.encodePacked(hex'ff', poolDeployer, keccak256(abi.encode(token0, token1)), POOL_INIT_CODE_HASH)
                )
            )
        );
    }
}
