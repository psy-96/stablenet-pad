// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArrayTester {
    address[] public whitelist;
    uint256[] public scores;

    event WhitelistUpdated(address[] accounts, uint256 count);
    event ScoresUpdated(uint256[] values, uint256 count);

    function setWhitelist(address[] calldata _accounts) external {
        delete whitelist;
        for (uint i = 0; i < _accounts.length; i++) {
            whitelist.push(_accounts[i]);
        }
        emit WhitelistUpdated(_accounts, _accounts.length);
    }

    function setScores(uint256[] calldata _values) external {
        delete scores;
        for (uint i = 0; i < _values.length; i++) {
            scores.push(_values[i]);
        }
        emit ScoresUpdated(_values, _values.length);
    }

    function getWhitelist() external view returns (address[] memory) {
        return whitelist;
    }

    function getScores() external view returns (uint256[] memory) {
        return scores;
    }

    function whitelistLength() external view returns (uint256) {
        return whitelist.length;
    }
}
