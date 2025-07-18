// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

interface IAlmPlugin {
	/// @notice Initializing ALM plugin
	/// @param _rebalanceManager address of rebalance manager
	/// @param _slowTwapPeriod period in seconds to get slow TWAP
	/// @param _fastTwapPeriod period in seconds to get fast TWAP
	function initializeALM(address _rebalanceManager, uint32 _slowTwapPeriod, uint32 _fastTwapPeriod) external;

	/// @notice Set slow TWAP period
	/// @param _slowTwapPeriod period in seconds to get slow TWAP
	function setSlowTwapPeriod(uint32 _slowTwapPeriod) external;

	/// @notice Set slow TWAP period
	/// @param _fastTwapPeriod period in seconds to get fast TWAP
	function setFastTwapPeriod(uint32 _fastTwapPeriod) external;

	/// @notice Set rebalance manager
	/// @param _rebalanceManager address of rebalance manager
	function setRebalanceManager(address _rebalanceManager) external;

	/// @notice Returns address of rebalance manager
	/// @return Address of rebalance manager
	function rebalanceManager() external view returns (address);

	/// @notice Returns time interval in seconds of slow TWAP period
	/// @return Time interval in seconds of slow TWAP period
	function slowTwapPeriod() external view returns (uint32);

	/// @notice Returns time interval in seconds of fast TWAP period
	/// @return Time interval in seconds of fast TWAP period
	function fastTwapPeriod() external view returns (uint32);
}