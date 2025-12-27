// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Roles
 * @dev Library defining all access control roles used across the ERC-3643 suite
 */
library Roles {
    /// @dev Role for contract administrators (can upgrade, manage roles)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @dev Role for token agents (can mint, burn, freeze, pause)
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    /// @dev Role for freezing addresses and tokens
    bytes32 public constant FREEZER_ROLE = keccak256("FREEZER_ROLE");

    /// @dev Role for managing compliance modules
    bytes32 public constant COMPLIANCE_MANAGER_ROLE = keccak256("COMPLIANCE_MANAGER_ROLE");

    /// @dev Role for managing identity registry
    bytes32 public constant REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");

    /// @dev Role for emergency operations
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    /// @dev Role for upgrading contracts
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @dev Role for token factory operations
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
}
