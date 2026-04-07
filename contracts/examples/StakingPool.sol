// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title StakingPool
/// @notice Demo single-asset staking pool. Users deposit ERC20 tokens and earn
///         a fixed reward rate (rewardPerBlock) set at initialization.
contract StakingPool is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    IERC20 public token;
    uint256 public rewardPerBlock;

    mapping(address => uint256) public stakedAmount;
    mapping(address => uint256) public lastClaimedBlock;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address token_) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        token = IERC20(token_);
        rewardPerBlock = 1e15; // 0.001 tokens per block (demo default)
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "StakingPool: zero amount");
        _claimReward(msg.sender);
        token.transferFrom(msg.sender, address(this), amount);
        stakedAmount[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(stakedAmount[msg.sender] >= amount, "StakingPool: insufficient stake");
        _claimReward(msg.sender);
        stakedAmount[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant {
        _claimReward(msg.sender);
    }

    function pendingReward(address user) external view returns (uint256) {
        uint256 blocks = block.number - lastClaimedBlock[user];
        return stakedAmount[user] * rewardPerBlock * blocks / 1e18;
    }

    function setRewardPerBlock(uint256 rate) external onlyOwner {
        rewardPerBlock = rate;
    }

    // ── internal ────────────────────────────────────────────────────────────

    function _claimReward(address user) internal {
        if (lastClaimedBlock[user] == 0) {
            lastClaimedBlock[user] = block.number;
            return;
        }
        uint256 blocks = block.number - lastClaimedBlock[user];
        uint256 reward = stakedAmount[user] * rewardPerBlock * blocks / 1e18;
        lastClaimedBlock[user] = block.number;
        if (reward > 0) {
            token.transfer(user, reward);
            emit RewardClaimed(user, reward);
        }
    }
}
