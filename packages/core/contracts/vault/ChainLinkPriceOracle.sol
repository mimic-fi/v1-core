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

import "../interfaces/IPriceOracle.sol";

contract ChainLinkPriceOracle is IPriceOracle {
    mapping(address => AggregatorV3Interface) internal ethPriceFeeds;

    constructor(address[] memory _tokens, AggregatorV3Interface[] memory _ethPriceFeeds) {
        require(_tokens.length == _ethPriceFeeds.length, "INVALID_FEEDS_LENGTH");

        for (uint256 i = 0; i < _tokens.length; i++) {
            ethPriceFeeds[_tokens[i]] = _ethPriceFeeds[i];
        }
    }

    function hasFeed(address token) public view returns (bool) {
        return address(ethPriceFeeds[token]) != address(0);
    }

    function getFeed(address token) public view returns (AggregatorV3Interface) {
        return ethPriceFeeds[token];
    }
    
    function getTokenPrice(address token, address base) external view override returns (uint256) {
        AggregatorV3Interface tokenPriceFeed = getFeed(token);
        require(address(tokenPriceFeed) != address(0), "MISSING_PRICE_FEED_FOR_TOKEN");

        AggregatorV3Interface basePriceFeed = getFeed(base);
        require(address(basePriceFeed) != address(0), "MISSING_PRICE_FEED_FOR_BASE");

        // Prices are expressed in ETH/token and ETH/base
        (, int256 tokenPrice, , , ) = tokenPriceFeed.latestRoundData();
        (, int256 basePrice, , , ) = basePriceFeed.latestRoundData();

        // Returns token/base
        return SafeCast.toUint256(basePrice / tokenPrice);
    }
}
