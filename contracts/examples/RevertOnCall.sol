// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RevertOnCall {
    uint256 public value;

    constructor() {
        value = 42;
    }

    function setValue(uint256 _value) external {
        revert("QA test: action revert");
    }

    function safeSetValue(uint256 _value) external {
        value = _value;
    }
}
