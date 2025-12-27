// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IComplianceModule.sol";
import "../../interfaces/ICompliance.sol";
import "../../interfaces/IERC3643.sol";
import "../../interfaces/IIdentityRegistry.sol";

/**
 * @title CountryRestrictModule
 * @dev Compliance module that restricts transfers based on country
 * @notice Can be configured to allow or block specific countries
 */
contract CountryRestrictModule is IComplianceModule, Ownable {
    /// @dev Mapping from compliance address to restricted countries
    mapping(address => mapping(uint16 => bool)) private _restrictedCountries;

    /// @dev Emitted when a country restriction is added
    event CountryRestricted(address indexed compliance, uint16 indexed country);

    /// @dev Emitted when a country restriction is removed
    event CountryUnrestricted(address indexed compliance, uint16 indexed country);

    constructor() Ownable(msg.sender) {}

    /// @inheritdoc IComplianceModule
    function name() external pure override returns (string memory) {
        return "CountryRestrictModule";
    }

    /**
     * @dev Adds a country to the restricted list
     * @param _compliance The compliance contract address
     * @param _country The country code to restrict
     */
    function addCountryRestriction(address _compliance, uint16 _country) external onlyOwner {
        require(!_restrictedCountries[_compliance][_country], "CountryRestrictModule: already restricted");
        _restrictedCountries[_compliance][_country] = true;
        emit CountryRestricted(_compliance, _country);
    }

    /**
     * @dev Removes a country from the restricted list
     * @param _compliance The compliance contract address
     * @param _country The country code to unrestrict
     */
    function removeCountryRestriction(address _compliance, uint16 _country) external onlyOwner {
        require(_restrictedCountries[_compliance][_country], "CountryRestrictModule: not restricted");
        _restrictedCountries[_compliance][_country] = false;
        emit CountryUnrestricted(_compliance, _country);
    }

    /**
     * @dev Checks if a country is restricted
     * @param _compliance The compliance contract address
     * @param _country The country code to check
     * @return bool True if restricted
     */
    function isCountryRestricted(address _compliance, uint16 _country) external view returns (bool) {
        return _restrictedCountries[_compliance][_country];
    }

    /// @inheritdoc IComplianceModule
    function moduleCheck(
        address _compliance,
        address _from,
        address _to,
        uint256 /*_value*/
    ) external view override returns (bool) {
        address token = ICompliance(_compliance).getTokenBound();
        address identityRegistry = IERC3643(token).identityRegistry();

        // Skip check for zero address (minting/burning)
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
    ) external override {
        // No action needed for this module
    }

    /// @inheritdoc IComplianceModule
    function moduleMintAction(address /*_compliance*/, address /*_to*/, uint256 /*_value*/) external override {
        // No action needed for this module
    }

    /// @inheritdoc IComplianceModule
    function moduleBurnAction(address /*_compliance*/, address /*_from*/, uint256 /*_value*/) external override {
        // No action needed for this module
    }

    /// @inheritdoc IComplianceModule
    function isPlugAndPlay(address /*_compliance*/) external pure override returns (bool) {
        return true;
    }
}
