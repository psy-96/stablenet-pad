// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract LiquidityPoolV2 is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public tokenA;
    IERC20Upgradeable public tokenB;
    uint256 public feeRate; // basis points (e.g. 30 = 0.3%)

    uint256 public reserveA;
    uint256 public reserveB;

    mapping(address => uint256) public liquidity;
    uint256 public totalLiquidity;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpTokens);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB);
    event Swapped(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _tokenA,
        address _tokenB,
        uint256 _feeRate
    ) public initializer {
        __Ownable_init(msg.sender);
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token address");
        require(_tokenA != _tokenB, "Tokens must be different");
        require(_feeRate <= 1000, "Fee too high"); // max 10%

        tokenA = IERC20Upgradeable(_tokenA);
        tokenB = IERC20Upgradeable(_tokenB);
        feeRate = _feeRate;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Amounts must be > 0");

        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);

        uint256 lpTokens;
        if (totalLiquidity == 0) {
            lpTokens = sqrt(amountA * amountB);
        } else {
            lpTokens = min(
                (amountA * totalLiquidity) / reserveA,
                (amountB * totalLiquidity) / reserveB
            );
        }

        liquidity[msg.sender] += lpTokens;
        totalLiquidity += lpTokens;
        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(msg.sender, amountA, amountB, lpTokens);
    }

    function removeLiquidity(uint256 lpTokens) external {
        require(lpTokens > 0 && liquidity[msg.sender] >= lpTokens, "Insufficient liquidity");

        uint256 amountA = (lpTokens * reserveA) / totalLiquidity;
        uint256 amountB = (lpTokens * reserveB) / totalLiquidity;

        liquidity[msg.sender] -= lpTokens;
        totalLiquidity -= lpTokens;
        reserveA -= amountA;
        reserveB -= amountB;

        tokenA.safeTransfer(msg.sender, amountA);
        tokenB.safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB);
    }

    function swapAforB(uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        amountOut = getAmountOut(amountIn, reserveA, reserveB);
        tokenA.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenB.safeTransfer(msg.sender, amountOut);
        reserveA += amountIn;
        reserveB -= amountOut;
        emit Swapped(msg.sender, address(tokenA), amountIn, amountOut);
    }

    function swapBforA(uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        amountOut = getAmountOut(amountIn, reserveB, reserveA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenA.safeTransfer(msg.sender, amountOut);
        reserveB += amountIn;
        reserveA -= amountOut;
        emit Swapped(msg.sender, address(tokenB), amountIn, amountOut);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public view returns (uint256) {
        require(reserveIn > 0 && reserveOut > 0, "Insufficient reserves");
        uint256 amountInWithFee = amountIn * (10000 - feeRate);
        return (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);
    }

    // utils
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}