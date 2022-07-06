// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'algebra-periphery/contracts/interfaces/IPeripheryPayments.sol';
import 'algebra-periphery/contracts/interfaces/external/IWNativeToken.sol';

import 'algebra-periphery/contracts/libraries/TransferHelper.sol';

abstract contract PeripheryPayments is IPeripheryPayments {
    address public immutable WNativeToken;

    constructor(address _WNativeToken) {
        WNativeToken = _WNativeToken;
    }

    receive() external payable {
        require(msg.sender == WNativeToken, 'Not WNativeToken');
    }

    /// @inheritdoc IPeripheryPayments
    function unwrapWNativeToken(uint256 amountMinimum, address recipient) external payable override {
        uint256 balanceWNativeToken = IWNativeToken(WNativeToken).balanceOf(address(this));
        require(balanceWNativeToken >= amountMinimum, 'Insufficient WNativeToken');

        if (balanceWNativeToken > 0) {
            IWNativeToken(WNativeToken).withdraw(balanceWNativeToken);
            TransferHelper.safeTransferNative(recipient, balanceWNativeToken);
        }
    }

    /// @inheritdoc IPeripheryPayments
    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable override {
        uint256 balanceToken = IERC20(token).balanceOf(address(this));
        require(balanceToken >= amountMinimum, 'Insufficient token');

        if (balanceToken > 0) {
            TransferHelper.safeTransfer(token, recipient, balanceToken);
        }
    }

    /// @inheritdoc IPeripheryPayments
    function refundNativeToken() external payable override {
        if (address(this).balance > 0) TransferHelper.safeTransferNative(msg.sender, address(this).balance);
    }
}
