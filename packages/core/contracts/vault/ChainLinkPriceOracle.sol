// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "../libraries/FixedPoint.sol";

import "../interfaces/IPriceOracle.sol";

contract ChainLinkPriceOracle is IPriceOracle {
    using FixedPoint for uint256;

    // Feed to use when price is one
    address private constant _PRICE_ONE_FEED = 0x1111111111111111111111111111111111111111;

    struct PriceFeed {
        uint8 tokenDecimals;
        AggregatorV3Interface aggregator;
    }

    mapping(address => PriceFeed) internal ethPriceFeeds;

    constructor(address[] memory tokens, AggregatorV3Interface[] memory aggregators) {
        require(tokens.length == aggregators.length, "INVALID_FEEDS_LENGTH");

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            AggregatorV3Interface aggregator = aggregators[i];

            // This version of the price oracle only handles 18 decimals prices
            // If a price feed is address 0x11..11, it will have a price of one
            bool worksWith18Decimals = address(aggregator) == _PRICE_ONE_FEED || aggregator.decimals() == 18;
            require(worksWith18Decimals, "INVALID_FEED_DECIMALS");

            uint8 tokenDecimals = IERC20Metadata(token).decimals();
            ethPriceFeeds[token] = PriceFeed({ aggregator: aggregator, tokenDecimals: tokenDecimals });
        }
    }

    function hasPriceFeed(address token) external view returns (bool) {
        return address(getPriceFeed(token).aggregator) != address(0);
    }

    function getPriceFeed(address token) public view returns (PriceFeed memory) {
        return ethPriceFeeds[token];
    }

    function getTokenPrice(address token, address base) external view override returns (uint256) {
        (uint256 basePrice, uint8 baseDecimals) = _getEthPriceIn(base);
        (uint256 tokenPrice, uint8 tokenDecimals) = _getEthPriceIn(token);

        // Price is token/base = (ETH/base) / (ETH/token)
        uint256 unscaledPrice = basePrice.div(tokenPrice);

        return
            tokenDecimals > baseDecimals
                ? (unscaledPrice * 10**(tokenDecimals - baseDecimals))
                : (unscaledPrice / 10**(baseDecimals - tokenDecimals));
    }

    function _getEthPriceIn(address token) internal view returns (uint256 price, uint8 tokenDecimals) {
        AggregatorV3Interface aggregator;
        (aggregator, tokenDecimals) = _getPriceFeed(token);
        price = _getAggregatorPrice(aggregator);
    }

    function _getAggregatorPrice(AggregatorV3Interface aggregator) internal view returns (uint256) {
        if (address(aggregator) == _PRICE_ONE_FEED) return FixedPoint.ONE;
        (, int256 priceInt, , , ) = aggregator.latestRoundData();
        return SafeCast.toUint256(priceInt);
    }

    function _getPriceFeed(address token) internal view returns (AggregatorV3Interface aggregator, uint8 tokenDecimals) {
        PriceFeed memory priceFeed = getPriceFeed(token);
        aggregator = priceFeed.aggregator;
        tokenDecimals = priceFeed.tokenDecimals;
        require(address(aggregator) != address(0), "TOKEN_WITH_NO_FEED");
    }
}
