// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AlwaysRevert {
    constructor() {
        revert("QA test: intentional revert");
    }
}
