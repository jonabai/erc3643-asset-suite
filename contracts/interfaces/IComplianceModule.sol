// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IComplianceModule
 * @dev Interface for compliance modules
 * @notice Each module implements specific compliance rules
 */
interface IComplianceModule {
    /**
     * @dev Returns the name of the module
     * @return The module name
     */
    function name() external view returns (string memory);

    /**
     * @dev Checks if a transfer is compliant according to this module
     * @param _compliance The compliance contract address
     * @param _from The sender address
     * @param _to The receiver address
     * @param _value The amount to transfer
     * @return bool True if compliant
     */
    function moduleCheck(
        address _compliance,
        address _from,
        address _to,
        uint256 _value
    ) external view returns (bool);

    /**
     * @dev Called when a transfer occurs
     * @param _compliance The compliance contract address
     * @param _from The sender address
     * @param _to The receiver address
     * @param _value The amount transferred
     */
    function moduleTransferAction(address _compliance, address _from, address _to, uint256 _value) external;

    /**
     * @dev Called when tokens are minted
     * @param _compliance The compliance contract address
     * @param _to The receiver address
     * @param _value The amount minted
     */
    function moduleMintAction(address _compliance, address _to, uint256 _value) external;

    /**
     * @dev Called when tokens are burned
     * @param _compliance The compliance contract address
     * @param _from The address from which tokens are burned
     * @param _value The amount burned
     */
    function moduleBurnAction(address _compliance, address _from, uint256 _value) external;

    /**
     * @dev Checks if the module is plug-and-play compatible
     * @param _compliance The compliance contract to check
     * @return bool True if compatible
     */
    function isPlugAndPlay(address _compliance) external view returns (bool);
}
