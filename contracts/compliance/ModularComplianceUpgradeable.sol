// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/ICompliance.sol";
import "../interfaces/IComplianceModule.sol";
import "../Roles.sol";

/**
 * @title ModularComplianceUpgradeable
 * @dev UUPS upgradeable modular compliance with role-based access control
 * @notice Allows adding/removing compliance modules to customize transfer rules
 */
contract ModularComplianceUpgradeable is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ICompliance
{
    // ===== Storage =====

    /// @dev The bound token address
    address private _tokenBound;

    /// @dev Array of compliance modules
    address[] private _modules;

    /// @dev Mapping to track bound modules
    mapping(address => bool) private _moduleBound;

    /// @dev Maximum number of modules allowed
    uint256 public constant MAX_MODULES = 25;

    /// @dev Gap for future storage variables
    uint256[50] private __gap;

    // ===== Events =====

    event Initialized(address indexed admin);

    // ===== Modifiers =====

    modifier onlyToken() {
        require(msg.sender == _tokenBound, "ModularCompliance: caller is not the token");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the compliance contract
     * @param admin_ Initial admin address
     */
    function initialize(address admin_) public initializer {
        require(admin_ != address(0), "ModularCompliance: zero admin");

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

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /// @inheritdoc ICompliance
    function getModules() external view override returns (address[] memory) {
        return _modules;
    }

    /// @inheritdoc ICompliance
    function isModuleBound(address _module) external view override returns (bool) {
        return _moduleBound[_module];
    }

    /// @inheritdoc ICompliance
    function getTokenBound() external view override returns (address) {
        return _tokenBound;
    }

    /// @inheritdoc ICompliance
    function canTransfer(address _from, address _to, uint256 _value) external view override returns (bool) {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            if (!IComplianceModule(_modules[i]).moduleCheck(address(this), _from, _to, _value)) {
                return false;
            }
        }
        return true;
    }

    // ===== Token Binding Functions =====

    /// @inheritdoc ICompliance
    function bindToken(address _token) external override onlyRole(Roles.ADMIN_ROLE) {
        require(_token != address(0), "ModularCompliance: zero address");
        require(_tokenBound == address(0), "ModularCompliance: token already bound");

        _tokenBound = _token;
        emit TokenBound(_token);
    }

    /// @inheritdoc ICompliance
    function unbindToken(address _token) external override onlyRole(Roles.ADMIN_ROLE) {
        require(_token == _tokenBound, "ModularCompliance: not the bound token");

        _tokenBound = address(0);
        emit TokenUnbound(_token);
    }

    // ===== Module Management Functions =====

    /// @inheritdoc ICompliance
    function addModule(address _module) external override onlyRole(Roles.COMPLIANCE_MANAGER_ROLE) {
        require(_module != address(0), "ModularCompliance: zero address");
        require(!_moduleBound[_module], "ModularCompliance: module already bound");
        require(_modules.length < MAX_MODULES, "ModularCompliance: max modules reached");

        _modules.push(_module);
        _moduleBound[_module] = true;

        emit ModuleAdded(_module);
    }

    /// @inheritdoc ICompliance
    function removeModule(address _module) external override onlyRole(Roles.COMPLIANCE_MANAGER_ROLE) {
        require(_moduleBound[_module], "ModularCompliance: module not bound");

        _moduleBound[_module] = false;

        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            if (_modules[i] == _module) {
                _modules[i] = _modules[length - 1];
                _modules.pop();
                break;
            }
        }

        emit ModuleRemoved(_module);
    }

    // ===== Compliance Hook Functions (called by token) =====

    /// @inheritdoc ICompliance
    function transferred(address _from, address _to, uint256 _value) external override onlyToken {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            IComplianceModule(_modules[i]).moduleTransferAction(address(this), _from, _to, _value);
        }
    }

    /// @inheritdoc ICompliance
    function created(address _to, uint256 _value) external override onlyToken {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            IComplianceModule(_modules[i]).moduleMintAction(address(this), _to, _value);
        }
    }

    /// @inheritdoc ICompliance
    function destroyed(address _from, uint256 _value) external override onlyToken {
        uint256 length = _modules.length;
        for (uint256 i = 0; i < length; i++) {
            IComplianceModule(_modules[i]).moduleBurnAction(address(this), _from, _value);
        }
    }
}
