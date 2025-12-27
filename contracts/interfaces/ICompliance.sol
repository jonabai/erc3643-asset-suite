// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICompliance
 * @dev Interface for the Compliance contract
 * @notice Handles compliance checking for token transfers
 */
interface ICompliance {
    /// @dev Emitted when a compliance module is added
    event ModuleAdded(address indexed module);

    /// @dev Emitted when a compliance module is removed
    event ModuleRemoved(address indexed module);

    /// @dev Emitted when the token is bound to compliance
    event TokenBound(address indexed token);

    /// @dev Emitted when the token is unbound from compliance
    event TokenUnbound(address indexed token);

    /**
     * @dev Binds a token to this compliance contract
     * @param _token The token contract address
     */
    function bindToken(address _token) external;

    /**
     * @dev Unbinds the token from this compliance contract
     * @param _token The token contract address
     */
    function unbindToken(address _token) external;

    /**
     * @dev Adds a compliance module
     * @param _module The module contract address
     */
    function addModule(address _module) external;

    /**
     * @dev Removes a compliance module
     * @param _module The module contract address
     */
    function removeModule(address _module) external;

    /**
     * @dev Checks if a transfer is compliant
     * @param _from The sender address
     * @param _to The receiver address
     * @param _value The amount to transfer
     * @return bool True if the transfer is compliant
     */
    function canTransfer(address _from, address _to, uint256 _value) external view returns (bool);

    /**
     * @dev Called when a transfer occurs to update compliance state
     * @param _from The sender address
     * @param _to The receiver address
     * @param _value The amount transferred
     */
    function transferred(address _from, address _to, uint256 _value) external;

    /**
     * @dev Called when tokens are created (minted)
     * @param _to The receiver address
     * @param _value The amount minted
     */
    function created(address _to, uint256 _value) external;

    /**
     * @dev Called when tokens are destroyed (burned)
     * @param _from The address from which tokens are burned
     * @param _value The amount burned
     */
    function destroyed(address _from, uint256 _value) external;

    /**
     * @dev Returns all bound compliance modules
     * @return Array of module addresses
     */
    function getModules() external view returns (address[] memory);

    /**
     * @dev Checks if a module is bound
     * @param _module The module address to check
     * @return bool True if the module is bound
     */
    function isModuleBound(address _module) external view returns (bool);

    /**
     * @dev Returns the bound token address
     * @return The token contract address
     */
    function getTokenBound() external view returns (address);
}
