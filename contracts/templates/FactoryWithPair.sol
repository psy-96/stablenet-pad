// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.5.16;

/**
 * FactoryWithPair — EIP-1167 minimal proxy + CREATE2로 페어를 생성하는 Factory.
 * SimpleFactory와 달리 createPair()를 포함하여 StableNet의 CREATE2 지원 여부를 검증.
 * pairImplementation: 이미 배포된 페어 구현체 주소
 */
contract FactoryWithPair {
    address public pairImplementation;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _pairImplementation) public {
        pairImplementation = _pairImplementation;
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    /**
     * CREATE2 + EIP-1167 minimal proxy로 페어 컨트랙트 배포.
     * 실패 시 CREATE2_FAILED revert — StableNet이 CREATE2를 지원하지 않으면 여기서 실패.
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS');

        // EIP-1167 minimal proxy 바이트코드 조립
        // 3d602d80600a3d3981f3363d3d373d3d3d363d73{impl}5af43d82803e903d91602b57fd5bf3
        bytes memory _code = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            pairImplementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(_code, 32), mload(_code), salt)
        }
        require(pair != address(0), 'UniswapV2: CREATE2_FAILED');

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
