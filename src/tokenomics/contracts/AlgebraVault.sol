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

    modifier onlyRelayerOrOwner(){
        require(msg.sender == relayer || msg.sender == owner, "only relayer or owner can call this");
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
        uint256 amountOutMin,
        uint256 withFee
    ) external onlyRelayerOrOwner {
        uint256 _allowance = tokenToSwap.allowance(address(this), address(AlgebraRouter));
        uint256 balance = tokenToSwap.balanceOf(address(this));
        uint256 amountOut;
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
        if (withFee == 0){
            ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams(
                path,
                address(this),
                block.timestamp,
                balance,
                amountOutMin
            );
            amountOut = AlgebraRouter.exactInput(
                params
            );
        }
        else{
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams(
                address(tokenToSwap),
                ALGB,
                address(this),
                block.timestamp,
                balance,
                amountOutMin,
                0
            );
            amountOut = AlgebraRouter.exactInputSingleSupportingFeeOnTransferTokens(
                params
            );
        }

        emit Swap(
            tokenToSwap,
            path,
            balance,
            amountOut
        );
    }

    function transferALGB(uint256 amountALGBToTransfer) external onlyRelayerOrOwner {
        IERC20 ALGBToken = IERC20(ALGB);
        ALGBToken.transfer(stakingAddress, amountALGBToTransfer);
    }

    function setRelayer(address _relayer) external onlyOwner{
        require(_relayer != address(0));
        relayer = _relayer;
    }

    function setStakingAddress(address _staking) external onlyOwner{
        require(_staking != address(0));
        stakingAddress = _staking;
    }

    function sweepTokens(IERC20 token, uint256 amount, address _to) external onlyOwner{
        require(_to != address(0));
        token.transfer(_to, amount);
    }

    function transferOwner(address _newOwner) external onlyOwner{
        require(_newOwner != address(0));
        owner = _newOwner;
    }
}