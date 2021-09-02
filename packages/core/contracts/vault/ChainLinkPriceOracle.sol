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

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../libraries/FixedPoint.sol";

import "../interfaces/IPriceOracle.sol";

contract ChainLinkPriceOracle is IPriceOracle {
    using FixedPoint for uint256;

    address private constant _PRICE_ONE_FEED =
        0x1111111111111111111111111111111111111111; // Feed to use when price is one

    mapping(address => AggregatorV3Interface) internal ethPriceFeeds;

    //If a price feed is address 0x0, it will have a price of one
    constructor(
        address[] memory _tokens,
        AggregatorV3Interface[] memory _ethPriceFeeds
    ) {
        require(
            _tokens.length == _ethPriceFeeds.length,
            "INVALID_FEEDS_LENGTH"
        );

        for (uint256 i = 0; i < _tokens.length; i++) {
            ethPriceFeeds[_tokens[i]] = _ethPriceFeeds[i];
        }
    }

    function hasFeed(address token) public view returns (bool) {
        return address(ethPriceFeeds[token]) != address(0);
    }

    function getFeed(address token)
        external
        view
        returns (AggregatorV3Interface)
    {
        require(hasFeed(token), "TOKEN_WITH_NO_FEED");
        return ethPriceFeeds[token];
    }

    function getTokenPrice(address token, address base)
        external
        view
        override
        returns (uint256)
    {
        require(hasFeed(token), "TOKEN_WITH_NO_FEED");
        require(hasFeed(base), "BASE_WITH_NO_FEED");

        AggregatorV3Interface tokenPriceFeed = ethPriceFeeds[token];
        AggregatorV3Interface basePriceFeed = ethPriceFeeds[base];

        // Prices are expressed in

        uint256 tokenPrice = FixedPoint.ONE;
        if (address(tokenPriceFeed) != _PRICE_ONE_FEED) {
            (, int256 tokenPriceIInt, , , ) = tokenPriceFeed.latestRoundData();
            tokenPrice = SafeCast.toUint256(tokenPriceIInt);
        }

        uint256 basePrice = FixedPoint.ONE;
        if (address(basePriceFeed) != _PRICE_ONE_FEED) {
            (, int256 basePriceIInt, , , ) = basePriceFeed.latestRoundData();
            basePrice = SafeCast.toUint256(basePriceIInt);
        }

        // Returns token/base = (ETH/base) / (ETH/token)
        return basePrice.div(tokenPrice);
    }
}
