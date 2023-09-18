// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import './libraries/SafeERC20Namer.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/INonfungibleTokenPositionDescriptor.sol';
import './libraries/PoolAddress.sol';
import './libraries/NFTDescriptor.sol';

/// @title Describes NFT token positions
/// @notice Produces a string containing the data URI for a JSON metadata string
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract NonfungibleTokenPositionDescriptor is INonfungibleTokenPositionDescriptor {
    int256 internal constant DENOMINATOR_SORT_ORDER = -100;

    address public immutable WNativeToken;
    address public immutable cachedThis;

    string private _nativeCurrencySymbol;
    mapping(address token => int256 ratioOrder) private _tokenRatioPriority;

    struct TokenRatioSortData {
        address tokenAddress;
        int256 tokenRatioSortOrder;
    }

    constructor(address _WNativeToken, string memory _nativeCurrencySymbol_, TokenRatioSortData[] memory tokenDatas) {
        WNativeToken = _WNativeToken;
        cachedThis = address(this);

        _nativeCurrencySymbol = _nativeCurrencySymbol_;
        _tokenRatioPriority[_WNativeToken] = DENOMINATOR_SORT_ORDER;

        uint256 _length = tokenDatas.length;
        if (_length > 0) {
            unchecked {
                for (uint256 i = 0; i < _length; i++) {
                    _tokenRatioPriority[tokenDatas[i].tokenAddress] = tokenDatas[i].tokenRatioSortOrder;
                }
            }
        }
    }

    function tokenRatioPriority(address token) public view returns (int256) {
        if (address(this) == cachedThis) {
            return _tokenRatioPriority[token];
        } else {
            return NonfungibleTokenPositionDescriptor(cachedThis).tokenRatioPriority(token);
        }
    }

    function nativeCurrencySymbol() public view returns (string memory) {
        if (address(this) == cachedThis) {
            return _nativeCurrencySymbol;
        } else {
            return NonfungibleTokenPositionDescriptor(cachedThis).nativeCurrencySymbol();
        }
    }

    /// @inheritdoc INonfungibleTokenPositionDescriptor
    function tokenURI(
        INonfungiblePositionManager positionManager,
        uint256 tokenId
    ) external view override returns (string memory) {
        (, , address token0, address token1, int24 tickLower, int24 tickUpper, , , , , ) = positionManager.positions(
            tokenId
        );

        IAlgebraPool pool = IAlgebraPool(
            PoolAddress.computeAddress(
                positionManager.poolDeployer(),
                PoolAddress.PoolKey({token0: token0, token1: token1})
            )
        );

        bool _flipRatio = flipRatio(token0, token1);
        address quoteTokenAddress = !_flipRatio ? token1 : token0;
        address baseTokenAddress = !_flipRatio ? token0 : token1;
        (, int24 tick, , , , ) = pool.globalState();

        return
            NFTDescriptor.constructTokenURI(
                NFTDescriptor.ConstructTokenURIParams({
                    tokenId: tokenId,
                    quoteTokenAddress: quoteTokenAddress,
                    baseTokenAddress: baseTokenAddress,
                    quoteTokenSymbol: quoteTokenAddress == WNativeToken
                        ? nativeCurrencySymbol()
                        : SafeERC20Namer.tokenSymbol(quoteTokenAddress),
                    baseTokenSymbol: baseTokenAddress == WNativeToken
                        ? nativeCurrencySymbol()
                        : SafeERC20Namer.tokenSymbol(baseTokenAddress),
                    quoteTokenDecimals: IERC20Metadata(quoteTokenAddress).decimals(),
                    baseTokenDecimals: IERC20Metadata(baseTokenAddress).decimals(),
                    flipRatio: _flipRatio,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickCurrent: tick,
                    tickSpacing: pool.tickSpacing(),
                    poolAddress: address(pool)
                })
            );
    }

    function flipRatio(address token0, address token1) public view returns (bool) {
        return tokenRatioPriority(token0) > tokenRatioPriority(token1);
    }
}
