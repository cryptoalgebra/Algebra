pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import 'algebra-periphery/contracts/interfaces/ISwapRouter.sol';

contract AlgebraVault{
    using SafeERC20 for IERC20;

    address public stakingAddress;
    address public ALGB;

    address public owner;
    address public relayer;

    ISwapRouter AlgebraRouter;

    event Swap(
        IERC20 swappedToken,
        bytes path,
        uint256 amountIn,
        uint256 amountOut
    );

    modifier onlyOwner(){
        require(msg.sender == owner, "only owner can call this");
        _;
    }

    modifier onlyRelayer(){
        require(msg.sender == relayer, "only relayer can call this");
        _;
    }

    constructor(
        address _ALGB,
        address _stakingAddress,
        ISwapRouter _AlgebraRouter
    ){
        owner = msg.sender;
        ALGB = _ALGB;
        stakingAddress = _stakingAddress;
        AlgebraRouter = _AlgebraRouter;
    }

    function swapToALGB(
        IERC20 tokenToSwap,
        bytes calldata path,
        uint256 amountOutMin
    ) external onlyRelayer{
        uint256 _allowance = tokenToSwap.allowance(address(this), address(AlgebraRouter));
        uint256 balance = tokenToSwap.balanceOf(address(this));
        if (_allowance < balance){
            if (_allowance == 0){
                tokenToSwap.safeApprove(address(AlgebraRouter), type(uint256).max);
            }
            else{
                try tokenToSwap.approve(address(AlgebraRouter), type(uint256).max) returns (bool res){
                    require(res == true, 'Vault: approve failed');
                }
                catch {
                    tokenToSwap.safeApprove(address(AlgebraRouter), 0);
                    tokenToSwap.safeApprove(address(AlgebraRouter), type(uint256).max);
                }
            }
        }

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams(
            path,
            stakingAddress,
            block.timestamp,
            balance,
            amountOutMin
        );

        uint256 amountOut = AlgebraRouter.exactInput(
            params
        );

        emit Swap(
            tokenToSwap,
            path,
            balance,
            amountOut
        );
    }

    function setRelayer(address _relayer) external onlyOwner{
        require(_relayer != address(0));
        relayer = _relayer;
    }

    function transferOwner(address _newOwner) external onlyOwner{
        require(_newOwner != address(0));
        owner = _newOwner;
    }
}