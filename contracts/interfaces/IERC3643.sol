// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IERC3643
 * @dev Interface for the ERC-3643 Security Token Standard
 * @notice Extends ERC-20 with compliance and identity features
 */
interface IERC3643 is IERC20 {
    /// @dev Emitted when the identity registry is set
    event IdentityRegistryAdded(address indexed identityRegistry);

    /// @dev Emitted when the compliance contract is set
    event ComplianceAdded(address indexed compliance);

    /// @dev Emitted when an address is frozen
    event AddressFrozen(address indexed userAddress, bool indexed isFrozen, address indexed owner);

    /// @dev Emitted when tokens are frozen for an address
    event TokensFrozen(address indexed userAddress, uint256 amount);

    /// @dev Emitted when tokens are unfrozen for an address
    event TokensUnfrozen(address indexed userAddress, uint256 amount);

    /// @dev Emitted when the token is paused
    event Paused(address indexed account);

    /// @dev Emitted when the token is unpaused
    event Unpaused(address indexed account);

    /// @dev Emitted when tokens are recovered from a lost wallet
    event RecoverySuccess(address indexed lostWallet, address indexed newWallet, address indexed investorOnchainID);

    /**
     * @dev Sets the identity registry contract
     * @param _identityRegistry The identity registry address
     */
    function setIdentityRegistry(address _identityRegistry) external;

    /**
     * @dev Sets the compliance contract
     * @param _compliance The compliance contract address
     */
    function setCompliance(address _compliance) external;

    /**
     * @dev Freezes or unfreezes an address
     * @param _userAddress The address to freeze/unfreeze
     * @param _freeze True to freeze, false to unfreeze
     */
    function setAddressFrozen(address _userAddress, bool _freeze) external;

    /**
     * @dev Freezes a specific amount of tokens for an address
     * @param _userAddress The address to freeze tokens for
     * @param _amount The amount to freeze
     */
    function freezePartialTokens(address _userAddress, uint256 _amount) external;

    /**
     * @dev Unfreezes a specific amount of tokens for an address
     * @param _userAddress The address to unfreeze tokens for
     * @param _amount The amount to unfreeze
     */
    function unfreezePartialTokens(address _userAddress, uint256 _amount) external;

    /**
     * @dev Pauses all token transfers
     */
    function pause() external;

    /**
     * @dev Unpauses token transfers
     */
    function unpause() external;

    /**
     * @dev Recovers tokens from a lost wallet to a new wallet
     * @param _lostWallet The lost wallet address
     * @param _newWallet The new wallet address
     * @param _investorOnchainID The investor's identity contract
     */
    function recoveryAddress(address _lostWallet, address _newWallet, address _investorOnchainID) external;

    /**
     * @dev Batch transfers tokens to multiple addresses
     * @param _toList Array of recipient addresses
     * @param _amounts Array of amounts to transfer
     */
    function batchTransfer(address[] calldata _toList, uint256[] calldata _amounts) external;

    /**
     * @dev Mints tokens to an address (forced, bypasses some checks)
     * @param _to The recipient address
     * @param _amount The amount to mint
     */
    function mint(address _to, uint256 _amount) external;

    /**
     * @dev Burns tokens from an address
     * @param _userAddress The address to burn from
     * @param _amount The amount to burn
     */
    function burn(address _userAddress, uint256 _amount) external;

    /**
     * @dev Returns the identity registry contract address
     * @return The identity registry address
     */
    function identityRegistry() external view returns (address);

    /**
     * @dev Returns the compliance contract address
     * @return The compliance address
     */
    function compliance() external view returns (address);

    /**
     * @dev Checks if an address is frozen
     * @param _userAddress The address to check
     * @return bool True if frozen
     */
    function isFrozen(address _userAddress) external view returns (bool);

    /**
     * @dev Returns the amount of frozen tokens for an address
     * @param _userAddress The address to check
     * @return The frozen amount
     */
    function getFrozenTokens(address _userAddress) external view returns (uint256);

    /**
     * @dev Returns whether the token is paused
     * @return bool True if paused
     */
    function paused() external view returns (bool);
}
