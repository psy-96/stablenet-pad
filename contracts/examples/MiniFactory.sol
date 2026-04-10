// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 아주 작은 자식 컨트랙트
contract Child {
    address public creator;
    constructor() {
        creator = msg.sender;
    }
}

// create2로 Child를 배포하는 최소 Factory
contract MiniFactory {
    event Deployed(address addr);

    function deploy(bytes32 salt) external returns (address) {
        bytes memory bytecode = type(Child).creationCode;
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(addr != address(0), "create2 failed");
        emit Deployed(addr);
        return addr;
    }
}
