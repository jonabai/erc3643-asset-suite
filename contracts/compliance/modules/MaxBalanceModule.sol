// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../interfaces/IComplianceModule.sol";
import "../../interfaces/ICompliance.sol";
import "../../interfaces/IERC3643.sol";
import "../../Roles.sol";

/**
 * @title MaxBalanceModule
 * @dev UUPS upgradeable compliance module that enforces maximum balance per holder
 */
contract MaxBalanceModule is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    IComplianceModule
{
    // ===== Storage =====

    /// @dev Mapping from compliance address to max balance limit
    mapping(address => uint256) private _maxBalance;

    /// @dev Gap for future storage variables
    uint256[50] private __gap;

    // ===== Events =====

    event Initialized(address indexed admin);
    event MaxBalanceSet(address indexed compliance, uint256 maxBalance);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the module
     * @param admin_ Initial admin address
     */
    function initialize(address admin_) public initializer {
        require(admin_ != address(0), "MaxBalanceModule: zero admin");

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
        return "MaxBalanceModule";
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    function getMaxBalance(address _compliance) external view returns (uint256) {
        return _maxBalance[_compliance];
    }

    /// @inheritdoc IComplianceModule
    function isPlugAndPlay(address /*_compliance*/) external pure override returns (bool) {
        return true;
    }

    // ===== Management Functions =====

    function setMaxBalance(
        address _compliance,
        uint256 _max
    ) external onlyRole(Roles.COMPLIANCE_MANAGER_ROLE) {
        require(_max > 0, "MaxBalanceModule: max must be greater than 0");
        _maxBalance[_compliance] = _max;
        emit MaxBalanceSet(_compliance, _max);
    }

    // ===== Compliance Module Functions =====

    /// @inheritdoc IComplianceModule
    function moduleCheck(
        address _compliance,
        address /*_from*/,
        address _to,
        uint256 _value
    ) external view override returns (bool) {
        if (_to == address(0)) {
            return true;
        }

        uint256 maxBal = _maxBalance[_compliance];
        if (maxBal == 0) {
            return true;
        }

        address token = ICompliance(_compliance).getTokenBound();
        uint256 currentBalance = IERC3643(token).balanceOf(_to);

        return (currentBalance + _value) <= maxBal;
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
