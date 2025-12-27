// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIdentityRegistry
 * @dev Interface for the Identity Registry contract
 * @notice Manages investor identities and their country codes for compliance
 */
interface IIdentityRegistry {
    /// @dev Emitted when an identity is registered
    event IdentityRegistered(address indexed investorAddress, address indexed identity);

    /// @dev Emitted when an identity is removed
    event IdentityRemoved(address indexed investorAddress, address indexed identity);

    /// @dev Emitted when an identity is updated
    event IdentityUpdated(address indexed oldIdentity, address indexed newIdentity);

    /// @dev Emitted when a country is updated for an investor
    event CountryUpdated(address indexed investorAddress, uint16 indexed country);

    /**
     * @dev Registers an identity for an investor
     * @param _userAddress The address of the investor
     * @param _identity The identity contract address (ONCHAINID)
     * @param _country The country code of the investor (ISO 3166-1 numeric)
     */
    function registerIdentity(address _userAddress, address _identity, uint16 _country) external;

    /**
     * @dev Removes the identity of an investor
     * @param _userAddress The address of the investor
     */
    function deleteIdentity(address _userAddress) external;

    /**
     * @dev Updates the identity contract of an investor
     * @param _userAddress The address of the investor
     * @param _identity The new identity contract address
     */
    function updateIdentity(address _userAddress, address _identity) external;

    /**
     * @dev Updates the country of an investor
     * @param _userAddress The address of the investor
     * @param _country The new country code
     */
    function updateCountry(address _userAddress, uint16 _country) external;

    /**
     * @dev Checks if an investor is verified (has valid identity claims)
     * @param _userAddress The address to check
     * @return bool True if the investor is verified
     */
    function isVerified(address _userAddress) external view returns (bool);

    /**
     * @dev Returns the identity contract address of an investor
     * @param _userAddress The address of the investor
     * @return The identity contract address
     */
    function identity(address _userAddress) external view returns (address);

    /**
     * @dev Returns the country code of an investor
     * @param _userAddress The address of the investor
     * @return The country code
     */
    function investorCountry(address _userAddress) external view returns (uint16);

    /**
     * @dev Checks if an address is registered
     * @param _userAddress The address to check
     * @return bool True if registered
     */
    function contains(address _userAddress) external view returns (bool);
}
