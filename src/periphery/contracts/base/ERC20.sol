pragma solidity ^0.8.17;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestToken is ERC20 {
    constructor() ERC20('USDT', 'USDT') {
        _mint(msg.sender, 10 ** 23);
    }
}
