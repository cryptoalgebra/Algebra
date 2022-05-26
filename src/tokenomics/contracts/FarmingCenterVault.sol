pragma solidity = 0.7.6;

import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';
import './interfaces/IFarmingCenterVault.sol';

contract FarmingCenterVault is IFarmingCenterVault{

    address public owner;

    constructor(){
        owner = msg.sender;
    }

    modifier onlyOwner(){
        require(msg.sender == owner, 'onlyowner');
        _;
    } 

    function claimTokens(address token, address to, uint256 amount) external override onlyOwner{
        TransferHelper.safeTransfer(token, to, amount);
    }

}