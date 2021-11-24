pragma solidity =0.8.4;

import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra-periphery/contracts/libraries/PoolAddress.sol';

contract AlgebraVault{
    uint256 splippage;
    address stakingAddress;
    address AlgebraFactory;
    address owner;

    event FeeDeposited(
        address depositedToken
    );

    modifier onlyOwner(){
        require(msg.sender == owner, "only owner can call this");
        _;
    }

    constructor(
        address _factory
    ){
        AlgebraFactory = _factory;
        owner = msg.sender;
    }

    /**
     * @dev Since the pool contract is barely fits the byte size limits, we do not want to
     * use any TransferFrom, which requires an allowance, or callback to pool. The idea is that only
     * pool can ERC20.transfer() to the vault and then call the deposit() to emit an event
     * @param depositedToken The address of token deposited
     */
    function deposit(address depositedToken) external{
        IAlgebraPool poolInstance = IAlgebraPool(msg.sender);
        pool = IAlgebraPool(PoolAddress.computeAddress(
            factory,
            PoolAddress.getPoolKey(poolInstance.token0(), poolInstance.token1())
        ));
        require(poolInstance == pool, "validation failed");

        emit FeeDeposited(depositedToken);
    }

}