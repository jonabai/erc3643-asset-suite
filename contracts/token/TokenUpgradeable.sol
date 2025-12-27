// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IERC3643Upgradeable.sol";
import "../interfaces/IIdentityRegistry.sol";
import "../interfaces/ICompliance.sol";
import "../Roles.sol";

/**
 * @title TokenUpgradeable
 * @dev UUPS upgradeable ERC-3643 compliant security token with role-based access control
 * @notice This token enforces compliance rules and identity verification for all transfers
 */
contract TokenUpgradeable is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IERC3643Upgradeable
{
    // ===== Storage =====
    // Note: Storage layout must remain consistent across upgrades

    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address private _identityRegistry;
    address private _compliance;

    mapping(address => bool) private _frozen;
    mapping(address => uint256) private _frozenTokens;

    /// @dev Gap for future storage variables (50 slots)
    uint256[50] private __gap;

    // ===== Events =====

    event Initialized(address indexed admin, string name, string symbol);

    // ===== Modifiers =====

    modifier whenNotFrozen(address _userAddress) {
        require(!_frozen[_userAddress], "Token: address is frozen");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the token (replaces constructor for upgradeable contracts)
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param identityRegistry_ Identity registry contract address
     * @param compliance_ Compliance contract address
     * @param admin_ Initial admin address
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address identityRegistry_,
        address compliance_,
        address admin_
    ) public initializer {
        require(bytes(name_).length > 0, "Token: name is empty");
        require(bytes(symbol_).length > 0, "Token: symbol is empty");
        require(identityRegistry_ != address(0), "Token: zero identity registry");
        require(compliance_ != address(0), "Token: zero compliance");
        require(admin_ != address(0), "Token: zero admin");

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _name = name_;
        _symbol = symbol_;
        _identityRegistry = identityRegistry_;
        _compliance = compliance_;

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(Roles.ADMIN_ROLE, admin_);
        _grantRole(Roles.UPGRADER_ROLE, admin_);
        _grantRole(Roles.AGENT_ROLE, admin_);
        _grantRole(Roles.FREEZER_ROLE, admin_);
        _grantRole(Roles.EMERGENCY_ROLE, admin_);

        emit Initialized(admin_, name_, symbol_);
    }

    // ===== UUPS Upgrade Authorization =====

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(Roles.UPGRADER_ROLE) {}

    // ===== ERC-20 View Functions =====

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external pure returns (uint8) {
        return _decimals;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowances[owner_][spender];
    }

    // ===== ERC-3643 View Functions =====

    function identityRegistry() external view override returns (address) {
        return _identityRegistry;
    }

    function compliance() external view override returns (address) {
        return _compliance;
    }

    function isFrozen(address _userAddress) external view override returns (bool) {
        return _frozen[_userAddress];
    }

    function getFrozenTokens(address _userAddress) external view override returns (uint256) {
        return _frozenTokens[_userAddress];
    }

    function paused() public view override(PausableUpgradeable, IERC3643Upgradeable) returns (bool) {
        return super.paused();
    }

    function version() external pure override returns (string memory) {
        return "1.0.0";
    }

    // ===== ERC-20 Transfer Functions =====

    function transfer(
        address to,
        uint256 amount
    ) external override whenNotPaused whenNotFrozen(msg.sender) nonReentrant returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override whenNotPaused whenNotFrozen(from) nonReentrant returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "Token: insufficient allowance");
            unchecked {
                _approve(from, msg.sender, currentAllowance - amount);
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    // ===== ERC-3643 Admin Functions =====

    function setIdentityRegistry(address identityRegistry_) external override onlyRole(Roles.ADMIN_ROLE) {
        require(identityRegistry_ != address(0), "Token: zero address");
        _identityRegistry = identityRegistry_;
        emit IdentityRegistryAdded(identityRegistry_);
    }

    function setCompliance(address compliance_) external override onlyRole(Roles.ADMIN_ROLE) {
        require(compliance_ != address(0), "Token: zero address");
        _compliance = compliance_;
        emit ComplianceAdded(compliance_);
    }

    function setAddressFrozen(address _userAddress, bool _freeze) external override onlyRole(Roles.FREEZER_ROLE) {
        require(_userAddress != address(0), "Token: zero address");
        _frozen[_userAddress] = _freeze;
        emit AddressFrozen(_userAddress, _freeze, msg.sender);
    }

    function freezePartialTokens(address _userAddress, uint256 _amount) external override onlyRole(Roles.FREEZER_ROLE) {
        require(_userAddress != address(0), "Token: zero address");
        require(_balances[_userAddress] >= _frozenTokens[_userAddress] + _amount, "Token: insufficient balance");
        _frozenTokens[_userAddress] += _amount;
        emit TokensFrozen(_userAddress, _amount);
    }

    function unfreezePartialTokens(
        address _userAddress,
        uint256 _amount
    ) external override onlyRole(Roles.FREEZER_ROLE) {
        require(_userAddress != address(0), "Token: zero address");
        require(_frozenTokens[_userAddress] >= _amount, "Token: insufficient frozen tokens");
        _frozenTokens[_userAddress] -= _amount;
        emit TokensUnfrozen(_userAddress, _amount);
    }

    function pause() external override onlyRole(Roles.EMERGENCY_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(Roles.EMERGENCY_ROLE) {
        _unpause();
    }

    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external override onlyRole(Roles.AGENT_ROLE) whenNotPaused nonReentrant {
        require(_lostWallet != address(0) && _newWallet != address(0), "Token: zero address");
        require(IIdentityRegistry(_identityRegistry).contains(_newWallet), "Token: new wallet not registered");
        require(
            IIdentityRegistry(_identityRegistry).identity(_newWallet) == _investorOnchainID,
            "Token: identity mismatch"
        );

        uint256 balance = _balances[_lostWallet];
        _balances[_lostWallet] = 0;
        _balances[_newWallet] += balance;

        _frozenTokens[_newWallet] = _frozenTokens[_lostWallet];
        _frozenTokens[_lostWallet] = 0;

        emit Transfer(_lostWallet, _newWallet, balance);
        emit RecoverySuccess(_lostWallet, _newWallet, _investorOnchainID);
    }

    function batchTransfer(
        address[] calldata _toList,
        uint256[] calldata _amounts
    ) external override whenNotPaused whenNotFrozen(msg.sender) nonReentrant {
        require(_toList.length == _amounts.length, "Token: arrays length mismatch");
        require(_toList.length <= 100, "Token: batch too large");

        for (uint256 i = 0; i < _toList.length; i++) {
            _transfer(msg.sender, _toList[i], _amounts[i]);
        }
    }

    function mint(address _to, uint256 _amount) external override onlyRole(Roles.AGENT_ROLE) whenNotPaused nonReentrant {
        require(_to != address(0), "Token: mint to zero address");
        require(IIdentityRegistry(_identityRegistry).isVerified(_to), "Token: recipient not verified");
        require(ICompliance(_compliance).canTransfer(address(0), _to, _amount), "Token: transfer not compliant");

        _totalSupply += _amount;
        _balances[_to] += _amount;

        ICompliance(_compliance).created(_to, _amount);

        emit Transfer(address(0), _to, _amount);
    }

    function burn(address _userAddress, uint256 _amount) external override onlyRole(Roles.AGENT_ROLE) nonReentrant {
        require(_userAddress != address(0), "Token: burn from zero address");
        require(_balances[_userAddress] >= _amount, "Token: burn amount exceeds balance");
        require(
            _balances[_userAddress] - _frozenTokens[_userAddress] >= _amount,
            "Token: frozen tokens cannot be burned"
        );

        _balances[_userAddress] -= _amount;
        _totalSupply -= _amount;

        ICompliance(_compliance).destroyed(_userAddress, _amount);

        emit Transfer(_userAddress, address(0), _amount);
    }

    // ===== Internal Functions =====

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Token: transfer from zero address");
        require(to != address(0), "Token: transfer to zero address");
        require(_balances[from] >= amount, "Token: transfer amount exceeds balance");
        require(_balances[from] - _frozenTokens[from] >= amount, "Token: insufficient unfrozen balance");
        require(IIdentityRegistry(_identityRegistry).isVerified(to), "Token: recipient not verified");
        require(ICompliance(_compliance).canTransfer(from, to, amount), "Token: transfer not compliant");

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }

        ICompliance(_compliance).transferred(from, to, amount);

        emit Transfer(from, to, amount);
    }

    function _approve(address owner_, address spender, uint256 amount) internal {
        require(owner_ != address(0), "Token: approve from zero address");
        require(spender != address(0), "Token: approve to zero address");

        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }
}
