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

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../libraries/FixedPoint.sol";

import "../interfaces/IPriceOracle.sol";

contract ChainLinkPriceOracle is IPriceOracle {
    using FixedPoint for uint256;

    address private constant _PRICE_ONE_FEED =
        0x1111111111111111111111111111111111111111; // Feed to use when price is one

    struct PriceFeed {
        AggregatorV3Interface aggregator;
        uint8 tokenDecimals;
    }

    mapping(address => PriceFeed) internal ethPriceFeeds;

    //If a price feed is address 0x11..11, it will have a price of one
    constructor(
        address[] memory _tokens,
        AggregatorV3Interface[] memory _aggregators
    ) {
        require(_tokens.length == _aggregators.length, "INVALID_FEEDS_LENGTH");

        for (uint256 i = 0; i < _tokens.length; i++) {
            //This version of the price oracle only handles 18 decimals prices
            require(
                address(_aggregators[i]) == _PRICE_ONE_FEED ||
                    _aggregators[i].decimals() == 18,
                "INVALID_FEED_DECIMALS"
            );

            ethPriceFeeds[_tokens[i]] = PriceFeed({
                aggregator: _aggregators[i],
                tokenDecimals: IERC20Metadata(_tokens[i]).decimals()
            });
        }
    }

    function hasPriceFeed(address token) public view returns (bool) {
        return address(ethPriceFeeds[token].aggregator) != address(0);
    }

    function getPriceFeed(address token)
        external
        view
        returns (PriceFeed memory)
    {
        require(hasPriceFeed(token), "TOKEN_WITH_NO_FEED");
        return ethPriceFeeds[token];
    }

    function getTokenPrice(address token, address base)
        external
        view
        override
        returns (uint256)
    {
        require(hasPriceFeed(token), "TOKEN_WITH_NO_FEED");
        require(hasPriceFeed(base), "BASE_WITH_NO_FEED");

        PriceFeed memory tokenPriceFeed = ethPriceFeeds[token];
        PriceFeed memory basePriceFeed = ethPriceFeeds[base];

        AggregatorV3Interface tokenAggregator = tokenPriceFeed.aggregator;
        AggregatorV3Interface baseAggregator = basePriceFeed.aggregator;

        uint8 tokenDecimals = tokenPriceFeed.tokenDecimals;
        uint8 baseDecimals = basePriceFeed.tokenDecimals;

        uint256 tokenPrice = FixedPoint.ONE;
        if (address(tokenAggregator) != _PRICE_ONE_FEED) {
            (, int256 tokenPriceInt, , , ) = tokenAggregator.latestRoundData();
            tokenPrice = SafeCast.toUint256(tokenPriceInt);
        }

        uint256 basePrice = FixedPoint.ONE;
        if (address(baseAggregator) != _PRICE_ONE_FEED) {
            (, int256 basePriceInt, , , ) = baseAggregator.latestRoundData();
            basePrice = SafeCast.toUint256(basePriceInt);
        }

        //Price is token/base = (ETH/base) / (ETH/token)
        uint256 notScaledPrice = basePrice.div(tokenPrice);

        return
            tokenDecimals > baseDecimals
                ? (notScaledPrice * 10**(tokenDecimals - baseDecimals))
                : (notScaledPrice / 10**(baseDecimals - tokenDecimals));
    }
}
