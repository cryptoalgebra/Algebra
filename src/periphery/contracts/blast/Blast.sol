// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

import './interfaces/IBlast.sol';
import './interfaces/IERC20Rebasing.sol';
import './interfaces/IBlastPoints.sol';

contract Blast {
    address public collector = 0xC1D7b84fb8fE0691D156eda30f51fD48d219ea94;

    // Blast Native Contracts
    IBlast public constant BLAST = IBlast(0x4300000000000000000000000000000000000002);
    IERC20Rebasing public constant USDBBLAST = IERC20Rebasing(0x4200000000000000000000000000000000000022);
    IERC20Rebasing public constant WETHBLAST = IERC20Rebasing(0x4200000000000000000000000000000000000023);
    IBlastPoints public constant BLASTPOINTS = IBlastPoints(0x2fc95838c71e76ec69ff817983BFf17c710F34E0);

    constructor() public {
        BLAST.configureClaimableYield(); // Configuring the yield for ETH deposits of this contract (if any) to be claimable
        BLAST.configureClaimableGas(); // Configuring the Gas Revenue collected by this contract to be claimable
        BLAST.configureGovernor(collector); // Setting Governor to manage the ETH yield and Gas Revenue. Initially set to the deployer

        WETHBLAST.configure(IERC20Rebasing.YieldMode.CLAIMABLE); // Configuring the yield for WETH deposits of this contract (if any) to be claimable
        USDBBLAST.configure(IERC20Rebasing.YieldMode.CLAIMABLE); // Configuring the yield for USDB deposits of this contract (if any) to be claimable
        BLASTPOINTS.configurePointsOperator(collector); // Configure Blast Points
    }

    /***********************************************/
    /****************** MODIFIERS ******************/
    /***********************************************/

    /**
     * @dev Check if caller is the collector
     */
    modifier onlyCollector() {
        require(collector == msg.sender, 'Blast: caller is not the collector');
        _;
    }

    /*******************************************************/
    /****************** COLLECTOR FUNCTIONS ****************/
    /*******************************************************/

    /**
     * @dev Calls claim function of WETH and USDB deposits (if any) for this contract to transfer the yield to the recipient
     *
     * Must only be called by the collector
     */
    function claimWethAndUsdbYield(address recipient, uint256 amount) public onlyCollector {
        WETHBLAST.claim(recipient, amount);
        USDBBLAST.claim(recipient, amount);
    }

    function setCollector(address _collector) external onlyCollector {
        collector = _collector;
    }
}
