// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IERC3643Upgradeable
 * @dev Interface for the upgradeable ERC-3643 Security Token Standard
 */
interface IERC3643Upgradeable is IERC20 {
    // ===== Events =====

    event IdentityRegistryAdded(address indexed identityRegistry);
    event ComplianceAdded(address indexed compliance);
    event AddressFrozen(address indexed userAddress, bool indexed isFrozen, address indexed owner);
    event TokensFrozen(address indexed userAddress, uint256 amount);
    event TokensUnfrozen(address indexed userAddress, uint256 amount);
    // Note: Paused/Unpaused events are inherited from PausableUpgradeable
    event RecoverySuccess(address indexed lostWallet, address indexed newWallet, address indexed investorOnchainID);

    // ===== Admin Functions =====

    function setIdentityRegistry(address _identityRegistry) external;
    function setCompliance(address _compliance) external;
    function setAddressFrozen(address _userAddress, bool _freeze) external;
    function freezePartialTokens(address _userAddress, uint256 _amount) external;
    function unfreezePartialTokens(address _userAddress, uint256 _amount) external;
    function pause() external;
    function unpause() external;
    function recoveryAddress(address _lostWallet, address _newWallet, address _investorOnchainID) external;
    function batchTransfer(address[] calldata _toList, uint256[] calldata _amounts) external;
    function mint(address _to, uint256 _amount) external;
    function burn(address _userAddress, uint256 _amount) external;

    // ===== View Functions =====

    function identityRegistry() external view returns (address);
    function compliance() external view returns (address);
    function isFrozen(address _userAddress) external view returns (bool);
    function getFrozenTokens(address _userAddress) external view returns (uint256);
    function paused() external view returns (bool);
    function version() external pure returns (string memory);
}
