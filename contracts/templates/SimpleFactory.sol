// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.5.16;

/**
 * UniswapV2Factory — Pair 바이트코드 없이 Factory 로직만 단독 테스트.
 * constructor(address _feeToSetter, address _pairImplementation)
 * 목적: StableNet 배포 실패(status 0x0) 원인 디버깅
 */
contract SimpleFactory {
    address public feeTo;
    address public feeToSetter;
    address public pairImplementation;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _feeToSetter, address _pairImplementation) public {
        feeToSetter = _feeToSetter;
        pairImplementation = _pairImplementation;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }
}
