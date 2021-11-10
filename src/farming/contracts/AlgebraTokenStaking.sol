// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;

import "./libraries/FreezableToken.sol";

// This contract handles swapping to and from xALGB, Algebra's staking token.
contract AlgebraTokenStaking is FreezableToken{
    using SafeMath for uint256;
    IERC20Minimal public ALGB;

    // Define the ALGB token contract
    constructor(IERC20Minimal _ALGB) ERC20("Algebra Staking Token", "xALGB"){
        ALGB = _ALGB;
    }

   function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
       (uint64 release, uint256 balance) = getFreezing(from, 0);
        if (release < block.timestamp && balance > 0){
            releaseAll(from);
        }
   }

    // Enter the bar. Pay some ALGBSs. Earn some shares.
    // Locks ALGB and mints xALGB
    function enter(uint256 _amount) public {
        // Gets the amount of ALGB locked in the contract
        uint256 totalALGB = ALGB.balanceOf(address(this));
        // Gets the amount of xALGB in existence
        uint256 totalShares = totalSupply();
        // If no xALGB exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalALGB == 0) {
            mintAndFreeze(msg.sender, _amount, uint64(block.timestamp + 1200));
        }
        // Calculate and mint the amount of xALGB the ALGB is worth. The ratio will change overtime, as xALGB is burned/minted and ALGB deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalALGB);
            mintAndFreeze(msg.sender, what, uint64(block.timestamp + 1200));
        }
        // Lock the ALGB in the contract
        ALGB.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your ALGBs.
    // Unlocks the staked + gained ALGB and burns xALGB
    function leave(uint256 _share) public {
        // Gets the amount of xALGB in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of ALGB the xALGB is worth
        uint256 what = _share.mul(ALGB.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        ALGB.transfer(msg.sender, what);
    }
}