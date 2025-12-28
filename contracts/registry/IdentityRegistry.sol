// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IIdentityRegistry.sol";
import "../Roles.sol";

/**
 * @title IdentityRegistry
 * @dev UUPS upgradeable identity registry with role-based access control
 * @notice Manages investor identities and their verification status
 */
contract IdentityRegistry is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    IIdentityRegistry
{
    // ===== Storage =====

    /// @dev Mapping from investor address to identity contract address
    mapping(address => address) private _identities;

    /// @dev Mapping from investor address to country code
    mapping(address => uint16) private _countries;

    /// @dev Mapping to track registered investors
    mapping(address => bool) private _registered;

    /// @dev Gap for future storage variables
    uint256[50] private __gap;

    // ===== Events =====

    event Initialized(address indexed admin);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the identity registry
     * @param admin_ Initial admin address
     */
    function initialize(address admin_) public initializer {
        require(admin_ != address(0), "IdentityRegistry: zero admin");

        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(Roles.ADMIN_ROLE, admin_);
        _grantRole(Roles.UPGRADER_ROLE, admin_);
        _grantRole(Roles.REGISTRY_MANAGER_ROLE, admin_);

        emit Initialized(admin_);
    }

    // ===== UUPS Upgrade Authorization =====

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(Roles.UPGRADER_ROLE) {}

    // ===== View Functions =====

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /// @inheritdoc IIdentityRegistry
    function isVerified(address _userAddress) external view override returns (bool) {
        return _registered[_userAddress];
    }

    /// @inheritdoc IIdentityRegistry
    function identity(address _userAddress) external view override returns (address) {
        return _identities[_userAddress];
    }

    /// @inheritdoc IIdentityRegistry
    function investorCountry(address _userAddress) external view override returns (uint16) {
        return _countries[_userAddress];
    }

    /// @inheritdoc IIdentityRegistry
    function contains(address _userAddress) external view override returns (bool) {
        return _registered[_userAddress];
    }

    // ===== Registry Management Functions =====

    /// @inheritdoc IIdentityRegistry
    function registerIdentity(
        address _userAddress,
        address _identity,
        uint16 _country
    ) external override onlyRole(Roles.REGISTRY_MANAGER_ROLE) {
        require(_userAddress != address(0), "IdentityRegistry: zero address");
        require(_identity != address(0), "IdentityRegistry: zero identity");
        require(!_registered[_userAddress], "IdentityRegistry: already registered");

        _identities[_userAddress] = _identity;
        _countries[_userAddress] = _country;
        _registered[_userAddress] = true;

        emit IdentityRegistered(_userAddress, _identity);
        emit CountryUpdated(_userAddress, _country);
    }

    /// @inheritdoc IIdentityRegistry
    function deleteIdentity(address _userAddress) external override onlyRole(Roles.REGISTRY_MANAGER_ROLE) {
        require(_registered[_userAddress], "IdentityRegistry: not registered");

        address oldIdentity = _identities[_userAddress];
        delete _identities[_userAddress];
        delete _countries[_userAddress];
        _registered[_userAddress] = false;

        emit IdentityRemoved(_userAddress, oldIdentity);
    }

    /// @inheritdoc IIdentityRegistry
    function updateIdentity(
        address _userAddress,
        address _identity
    ) external override onlyRole(Roles.REGISTRY_MANAGER_ROLE) {
        require(_registered[_userAddress], "IdentityRegistry: not registered");
        require(_identity != address(0), "IdentityRegistry: zero identity");

        address oldIdentity = _identities[_userAddress];
        _identities[_userAddress] = _identity;

        emit IdentityUpdated(oldIdentity, _identity);
    }

    /// @inheritdoc IIdentityRegistry
    function updateCountry(
        address _userAddress,
        uint16 _country
    ) external override onlyRole(Roles.REGISTRY_MANAGER_ROLE) {
        require(_registered[_userAddress], "IdentityRegistry: not registered");

        _countries[_userAddress] = _country;

        emit CountryUpdated(_userAddress, _country);
    }

    /**
     * @dev Batch register multiple identities
     * @param _userAddresses Array of user addresses
     * @param _identityAddresses Array of identity addresses
     * @param _countryCodes Array of country codes
     */
    function batchRegisterIdentity(
        address[] calldata _userAddresses,
        address[] calldata _identityAddresses,
        uint16[] calldata _countryCodes
    ) external onlyRole(Roles.REGISTRY_MANAGER_ROLE) {
        require(
            _userAddresses.length == _identityAddresses.length &&
            _userAddresses.length == _countryCodes.length,
            "IdentityRegistry: arrays length mismatch"
        );
        require(_userAddresses.length <= 100, "IdentityRegistry: batch too large");

        for (uint256 i = 0; i < _userAddresses.length; i++) {
            require(_userAddresses[i] != address(0), "IdentityRegistry: zero address");
            require(_identityAddresses[i] != address(0), "IdentityRegistry: zero identity");
            require(!_registered[_userAddresses[i]], "IdentityRegistry: already registered");

            _identities[_userAddresses[i]] = _identityAddresses[i];
            _countries[_userAddresses[i]] = _countryCodes[i];
            _registered[_userAddresses[i]] = true;

            emit IdentityRegistered(_userAddresses[i], _identityAddresses[i]);
            emit CountryUpdated(_userAddresses[i], _countryCodes[i]);
        }
    }
}
