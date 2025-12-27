// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @dev Manages investor identities and their verification status
 * @notice This is a simplified implementation for demonstration purposes
 */
contract IdentityRegistry is IIdentityRegistry, Ownable {
    /// @dev Mapping from investor address to identity contract address
    mapping(address => address) private _identities;

    /// @dev Mapping from investor address to country code
    mapping(address => uint16) private _countries;

    /// @dev Mapping to track registered investors
    mapping(address => bool) private _registered;

    /// @dev Mapping for agent permissions
    mapping(address => bool) private _agents;

    /// @dev Emitted when an agent is added
    event AgentAdded(address indexed agent);

    /// @dev Emitted when an agent is removed
    event AgentRemoved(address indexed agent);

    modifier onlyAgent() {
        require(_agents[msg.sender] || msg.sender == owner(), "IdentityRegistry: caller is not an agent");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Adds an agent who can manage identities
     * @param _agent The agent address
     */
    function addAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "IdentityRegistry: zero address");
        require(!_agents[_agent], "IdentityRegistry: already an agent");
        _agents[_agent] = true;
        emit AgentAdded(_agent);
    }

    /**
     * @dev Removes an agent
     * @param _agent The agent address
     */
    function removeAgent(address _agent) external onlyOwner {
        require(_agents[_agent], "IdentityRegistry: not an agent");
        _agents[_agent] = false;
        emit AgentRemoved(_agent);
    }

    /**
     * @dev Checks if an address is an agent
     * @param _agent The address to check
     * @return bool True if agent
     */
    function isAgent(address _agent) external view returns (bool) {
        return _agents[_agent];
    }

    /// @inheritdoc IIdentityRegistry
    function registerIdentity(address _userAddress, address _identity, uint16 _country) external override onlyAgent {
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
    function deleteIdentity(address _userAddress) external override onlyAgent {
        require(_registered[_userAddress], "IdentityRegistry: not registered");

        address oldIdentity = _identities[_userAddress];
        delete _identities[_userAddress];
        delete _countries[_userAddress];
        _registered[_userAddress] = false;

        emit IdentityRemoved(_userAddress, oldIdentity);
    }

    /// @inheritdoc IIdentityRegistry
    function updateIdentity(address _userAddress, address _identity) external override onlyAgent {
        require(_registered[_userAddress], "IdentityRegistry: not registered");
        require(_identity != address(0), "IdentityRegistry: zero identity");

        address oldIdentity = _identities[_userAddress];
        _identities[_userAddress] = _identity;

        emit IdentityUpdated(oldIdentity, _identity);
    }

    /// @inheritdoc IIdentityRegistry
    function updateCountry(address _userAddress, uint16 _country) external override onlyAgent {
        require(_registered[_userAddress], "IdentityRegistry: not registered");

        _countries[_userAddress] = _country;

        emit CountryUpdated(_userAddress, _country);
    }

    /// @inheritdoc IIdentityRegistry
    function isVerified(address _userAddress) external view override returns (bool) {
        // In a full implementation, this would check claims against the identity contract
        // For now, we just check if the user is registered
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
}
