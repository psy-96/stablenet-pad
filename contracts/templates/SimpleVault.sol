// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title SimpleVault
/// @notice Ether custody vault — only owner can withdraw.
contract SimpleVault is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    bool private _locked;

    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) public initializer {
        __Ownable_init(owner_);
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(!_locked, "SimpleVault: reentrant call");
        require(amount <= address(this).balance, "SimpleVault: insufficient balance");
        _locked = true;
        emit Withdrawn(to, amount);
        (bool ok, ) = to.call{value: amount}("");
        _locked = false;
        require(ok, "SimpleVault: transfer failed");
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
