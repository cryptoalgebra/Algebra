// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IAlgebraPoolDeployer.sol';
import './interfaces/IDataStorageOperator.sol';

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
    address public override stakerAddress;

    // @inheritdoc IAlgebraFactory
    address public override vaultAddress;

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
    function setStakerAddress(address _stakerAddress) external override onlyOwner {
        stakerAddress = _stakerAddress;
    }

    // @inheritdoc IAlgebraFactory
    function setVaultAddress(address _vaultAddres) external override onlyOwner {
        vaultAddress = _vaultAddres;
    }

    bytes32 internal constant POOL_INIT_CODE_HASH = 0x3053a47763f959a1a7c44f3e89144f0b9b20acf59ffae4b693aab3965c7d6bf5;

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
