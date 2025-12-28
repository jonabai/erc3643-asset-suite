// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../interfaces/IComplianceModule.sol";
import "../../interfaces/ICompliance.sol";
import "../../interfaces/IERC3643.sol";
import "../../interfaces/IIdentityRegistry.sol";
import "../../Roles.sol";

/**
 * @title CountryRestrictModule
 * @dev UUPS upgradeable compliance module that restricts transfers based on country
 */
contract CountryRestrictModule is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    IComplianceModule
{
    // ===== Storage =====

    /// @dev Mapping from compliance address to restricted countries
    mapping(address => mapping(uint16 => bool)) private _restrictedCountries;

    /// @dev Gap for future storage variables
    uint256[50] private __gap;

    // ===== Events =====

    event Initialized(address indexed admin);
    event CountryRestricted(address indexed compliance, uint16 indexed country);
    event CountryUnrestricted(address indexed compliance, uint16 indexed country);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the module
     * @param admin_ Initial admin address
     */
    function initialize(address admin_) public initializer {
        require(admin_ != address(0), "CountryRestrictModule: zero admin");

        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(Roles.ADMIN_ROLE, admin_);
        _grantRole(Roles.UPGRADER_ROLE, admin_);
        _grantRole(Roles.COMPLIANCE_MANAGER_ROLE, admin_);

        emit Initialized(admin_);
    }

    // ===== UUPS Upgrade Authorization =====

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(Roles.UPGRADER_ROLE) {}

    // ===== View Functions =====

    /// @inheritdoc IComplianceModule
    function name() external pure override returns (string memory) {
        return "CountryRestrictModule";
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    function isCountryRestricted(address _compliance, uint16 _country) external view returns (bool) {
        return _restrictedCountries[_compliance][_country];
    }

    /// @inheritdoc IComplianceModule
    function isPlugAndPlay(address /*_compliance*/) external pure override returns (bool) {
        return true;
    }

    // ===== Management Functions =====

    function addCountryRestriction(
        address _compliance,
        uint16 _country
    ) external onlyRole(Roles.COMPLIANCE_MANAGER_ROLE) {
        require(!_restrictedCountries[_compliance][_country], "CountryRestrictModule: already restricted");
        _restrictedCountries[_compliance][_country] = true;
        emit CountryRestricted(_compliance, _country);
    }

    function removeCountryRestriction(
        address _compliance,
        uint16 _country
    ) external onlyRole(Roles.COMPLIANCE_MANAGER_ROLE) {
        require(_restrictedCountries[_compliance][_country], "CountryRestrictModule: not restricted");
        _restrictedCountries[_compliance][_country] = false;
        emit CountryUnrestricted(_compliance, _country);
    }

    function batchAddCountryRestrictions(
        address _compliance,
        uint16[] calldata _countries
    ) external onlyRole(Roles.COMPLIANCE_MANAGER_ROLE) {
        require(_countries.length <= 50, "CountryRestrictModule: batch too large");
        for (uint256 i = 0; i < _countries.length; i++) {
            if (!_restrictedCountries[_compliance][_countries[i]]) {
                _restrictedCountries[_compliance][_countries[i]] = true;
                emit CountryRestricted(_compliance, _countries[i]);
            }
        }
    }

    // ===== Compliance Module Functions =====

    /// @inheritdoc IComplianceModule
    function moduleCheck(
        address _compliance,
        address _from,
        address _to,
        uint256 /*_value*/
    ) external view override returns (bool) {
        address token = ICompliance(_compliance).getTokenBound();
        address identityRegistry = IERC3643(token).identityRegistry();

        if (_from != address(0)) {
            uint16 fromCountry = IIdentityRegistry(identityRegistry).investorCountry(_from);
            if (_restrictedCountries[_compliance][fromCountry]) {
                return false;
            }
        }

        if (_to != address(0)) {
            uint16 toCountry = IIdentityRegistry(identityRegistry).investorCountry(_to);
            if (_restrictedCountries[_compliance][toCountry]) {
                return false;
            }
        }

        return true;
    }

    /// @inheritdoc IComplianceModule
    function moduleTransferAction(
        address /*_compliance*/,
        address /*_from*/,
        address /*_to*/,
        uint256 /*_value*/
    ) external override {}

    /// @inheritdoc IComplianceModule
    function moduleMintAction(address /*_compliance*/, address /*_to*/, uint256 /*_value*/) external override {}

    /// @inheritdoc IComplianceModule
    function moduleBurnAction(address /*_compliance*/, address /*_from*/, uint256 /*_value*/) external override {}
}
