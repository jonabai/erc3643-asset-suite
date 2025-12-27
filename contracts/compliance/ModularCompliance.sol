// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ICompliance.sol";
import "../interfaces/IComplianceModule.sol";

/**
 * @title ModularCompliance
 * @dev Modular compliance contract that can have multiple compliance modules
 * @notice Allows adding/removing compliance modules to customize transfer rules
 */
contract ModularCompliance is ICompliance, Ownable {
    /// @dev The bound token address
    address private _tokenBound;

    /// @dev Array of compliance modules
    address[] private _modules;

    /// @dev Mapping to track bound modules
    mapping(address => bool) private _moduleBound;

    /// @dev Maximum number of modules allowed
    uint256 public constant MAX_MODULES = 25;

    modifier onlyToken() {
        require(msg.sender == _tokenBound, "ModularCompliance: caller is not the token");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @inheritdoc ICompliance
    function bindToken(address _token) external override onlyOwner {
        require(_token != address(0), "ModularCompliance: zero address");
        require(_tokenBound == address(0), "ModularCompliance: token already bound");

        _tokenBound = _token;
        emit TokenBound(_token);
    }

    /// @inheritdoc ICompliance
    function unbindToken(address _token) external override onlyOwner {
        require(_token == _tokenBound, "ModularCompliance: not the bound token");

        _tokenBound = address(0);
        emit TokenUnbound(_token);
    }

    /// @inheritdoc ICompliance
    function addModule(address _module) external override onlyOwner {
        require(_module != address(0), "ModularCompliance: zero address");
        require(!_moduleBound[_module], "ModularCompliance: module already bound");
        require(_modules.length < MAX_MODULES, "ModularCompliance: max modules reached");

        _modules.push(_module);
        _moduleBound[_module] = true;

        emit ModuleAdded(_module);
    }

    /// @inheritdoc ICompliance
    function removeModule(address _module) external override onlyOwner {
        require(_moduleBound[_module], "ModularCompliance: module not bound");

        _moduleBound[_module] = false;

        // Find and remove the module from the array
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
}
