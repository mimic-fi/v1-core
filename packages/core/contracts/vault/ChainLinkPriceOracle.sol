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

import "../interfaces/IPriceOracle.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract ChainLinkPriceOracle is IPriceOracle {
    mapping(address => AggregatorV3Interface) internal ethPriceFeeds;

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

    function getTokenPrice(address token, address base)
        external
        view
        override
        returns (uint256)
    {
        require(address(ethPriceFeeds[token]) != address(0), "INVALID_TOKEN");
        require(address(ethPriceFeeds[base]) != address(0), "INVALID_BASE");

        //Prices are expressed in ETH/TOKEN and ETH/BASE
        (, int256 tokenPrice, , , ) = ethPriceFeeds[token].latestRoundData();
        (, int256 basePrice, , , ) = ethPriceFeeds[base].latestRoundData();

        //Returns TOKEN/BASE
        return uint256(basePrice / tokenPrice);
    }

    function hasFeed(address token) external view returns (bool) {
        return address(ethPriceFeeds[token]) != address(0);
    }

    function getFeed(address token)
        external
        view
        returns (AggregatorV3Interface)
    {
        return ethPriceFeeds[token];
    }
}
