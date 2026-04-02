// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title LiquidityPool
 * @notice StableNet 테스트넷 표준 LiquidityPool 템플릿 (ERC1967 Proxy 패턴)
 */
contract LiquidityPool is Initializable, OwnableUpgradeable {
    address public tokenA;
    address public tokenB;
    uint24 public fee;

    uint256 public reserveA;
    uint256 public reserveB;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB);
    event Swapped(
        address indexed trader,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _tokenA, address _tokenB, uint24 _fee) public initializer {
        __Ownable_init(msg.sender);
        require(_tokenA != address(0) && _tokenB != address(0), "LiquidityPool: invalid token address");
        require(_tokenA != _tokenB, "LiquidityPool: identical tokens");
        tokenA = _tokenA;
        tokenB = _tokenB;
        fee = _fee;
    }

    function getReserves() external view returns (uint256 _reserveA, uint256 _reserveB) {
        return (reserveA, reserveB);
    }
}
