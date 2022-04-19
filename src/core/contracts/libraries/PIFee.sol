pragma solidity = 0.7.6;

library PIFee{

    uint16 internal constant maxFee = 50000;

    function recalculateFee(bool zeroForOne, uint160 startPrice, uint160 currentPrice, uint16 startFee, uint16 currentFee) internal pure returns(uint16 fee){
        if(currentFee == maxFee) {
            return maxFee;
        }
        fee = zeroForOne ? uint16(uint176(startPrice) * startFee / currentPrice) : uint16(uint176(currentPrice) * startFee / startPrice); 
        if(fee < currentFee || fee > maxFee) {
            return maxFee;
        } 
    }
}