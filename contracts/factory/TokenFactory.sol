// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../token/TokenUpgradeable.sol";
import "../registry/IdentityRegistryUpgradeable.sol";
import "../compliance/ModularComplianceUpgradeable.sol";
import "../Roles.sol";

/**
 * @title TokenFactory
 * @dev Factory contract for deploying ERC-3643 compliant security tokens
 * @notice Deploys complete token suites with identity registry and compliance
 */
contract TokenFactory is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    // ===== Storage =====

    /// @dev Implementation addresses for proxy deployment
    address public tokenImplementation;
    address public identityRegistryImplementation;
    address public complianceImplementation;

    /// @dev Array of all deployed tokens
    address[] private _deployedTokens;

    /// @dev Mapping from token address to deployment info
    mapping(address => TokenDeployment) private _tokenDeployments;

    /// @dev Deployment counter for unique salt generation
    uint256 private _deploymentCounter;

    /// @dev Gap for future storage variables
    uint256[50] private __gap;

    // ===== Structs =====

    struct TokenDeployment {
        address token;
        address identityRegistry;
        address compliance;
        string name;
        string symbol;
        address deployer;
        uint256 deployedAt;
        bool exists;
    }

    struct DeploymentParams {
        string name;
        string symbol;
        address tokenAdmin;
        address registryAdmin;
        address complianceAdmin;
    }

    // ===== Events =====

    event Initialized(address indexed admin);
    event ImplementationsSet(address token, address identityRegistry, address compliance);
    event TokenSuiteDeployed(
        address indexed token,
        address indexed identityRegistry,
        address indexed compliance,
        string name,
        string symbol,
        address deployer
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the factory
     * @param admin_ Initial admin address
     * @param tokenImpl_ Token implementation address
     * @param registryImpl_ Identity registry implementation address
     * @param complianceImpl_ Compliance implementation address
     */
    function initialize(
        address admin_,
        address tokenImpl_,
        address registryImpl_,
        address complianceImpl_
    ) public initializer {
        require(admin_ != address(0), "TokenFactory: zero admin");
        require(tokenImpl_ != address(0), "TokenFactory: zero token impl");
        require(registryImpl_ != address(0), "TokenFactory: zero registry impl");
        require(complianceImpl_ != address(0), "TokenFactory: zero compliance impl");

        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(Roles.ADMIN_ROLE, admin_);
        _grantRole(Roles.UPGRADER_ROLE, admin_);
        _grantRole(Roles.FACTORY_ROLE, admin_);

        tokenImplementation = tokenImpl_;
        identityRegistryImplementation = registryImpl_;
        complianceImplementation = complianceImpl_;

        emit Initialized(admin_);
        emit ImplementationsSet(tokenImpl_, registryImpl_, complianceImpl_);
    }

    // ===== UUPS Upgrade Authorization =====

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(Roles.UPGRADER_ROLE) {}

    // ===== View Functions =====

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    /**
     * @dev Returns all deployed token addresses
     */
    function getDeployedTokens() external view returns (address[] memory) {
        return _deployedTokens;
    }

    /**
     * @dev Returns the number of deployed tokens
     */
    function getDeployedTokenCount() external view returns (uint256) {
        return _deployedTokens.length;
    }

    /**
     * @dev Returns deployment info for a token
     * @param token The token address
     */
    function getTokenDeployment(address token) external view returns (TokenDeployment memory) {
        require(_tokenDeployments[token].exists, "TokenFactory: token not found");
        return _tokenDeployments[token];
    }

    /**
     * @dev Checks if a token was deployed by this factory
     * @param token The token address to check
     */
    function isFactoryDeployed(address token) external view returns (bool) {
        return _tokenDeployments[token].exists;
    }

    // ===== Admin Functions =====

    /**
     * @dev Updates implementation addresses
     * @param tokenImpl_ New token implementation
     * @param registryImpl_ New identity registry implementation
     * @param complianceImpl_ New compliance implementation
     */
    function setImplementations(
        address tokenImpl_,
        address registryImpl_,
        address complianceImpl_
    ) external onlyRole(Roles.ADMIN_ROLE) {
        require(tokenImpl_ != address(0), "TokenFactory: zero token impl");
        require(registryImpl_ != address(0), "TokenFactory: zero registry impl");
        require(complianceImpl_ != address(0), "TokenFactory: zero compliance impl");

        tokenImplementation = tokenImpl_;
        identityRegistryImplementation = registryImpl_;
        complianceImplementation = complianceImpl_;

        emit ImplementationsSet(tokenImpl_, registryImpl_, complianceImpl_);
    }

    // ===== Deployment Functions =====

    /**
     * @dev Deploys a complete token suite (token + identity registry + compliance)
     * @param params Deployment parameters
     * @return token The deployed token proxy address
     * @return identityRegistry The deployed identity registry proxy address
     * @return compliance The deployed compliance proxy address
     */
    function deployTokenSuite(
        DeploymentParams calldata params
    ) external onlyRole(Roles.FACTORY_ROLE) returns (address token, address identityRegistry, address compliance) {
        require(bytes(params.name).length > 0, "TokenFactory: empty name");
        require(bytes(params.symbol).length > 0, "TokenFactory: empty symbol");
        require(params.tokenAdmin != address(0), "TokenFactory: zero token admin");
        require(params.registryAdmin != address(0), "TokenFactory: zero registry admin");
        require(params.complianceAdmin != address(0), "TokenFactory: zero compliance admin");

        _deploymentCounter++;

        // Deploy Identity Registry Proxy
        identityRegistry = _deployProxy(
            identityRegistryImplementation,
            abi.encodeWithSelector(
                IdentityRegistryUpgradeable.initialize.selector,
                params.registryAdmin
            ),
            keccak256(abi.encodePacked("registry", _deploymentCounter, block.timestamp))
        );

        // Deploy Compliance Proxy
        compliance = _deployProxy(
            complianceImplementation,
            abi.encodeWithSelector(
                ModularComplianceUpgradeable.initialize.selector,
                params.complianceAdmin
            ),
            keccak256(abi.encodePacked("compliance", _deploymentCounter, block.timestamp))
        );

        // Deploy Token Proxy
        token = _deployProxy(
            tokenImplementation,
            abi.encodeWithSelector(
                TokenUpgradeable.initialize.selector,
                params.name,
                params.symbol,
                identityRegistry,
                compliance,
                params.tokenAdmin
            ),
            keccak256(abi.encodePacked("token", _deploymentCounter, block.timestamp))
        );

        // Bind token to compliance (caller must be admin of compliance)
        // The compliance admin will need to call bindToken separately
        // or we can grant the factory temporary access

        // Store deployment info
        _deployedTokens.push(token);
        _tokenDeployments[token] = TokenDeployment({
            token: token,
            identityRegistry: identityRegistry,
            compliance: compliance,
            name: params.name,
            symbol: params.symbol,
            deployer: msg.sender,
            deployedAt: block.timestamp,
            exists: true
        });

        emit TokenSuiteDeployed(token, identityRegistry, compliance, params.name, params.symbol, msg.sender);

        return (token, identityRegistry, compliance);
    }

    /**
     * @dev Deploys a token with existing identity registry and compliance
     * @param name Token name
     * @param symbol Token symbol
     * @param existingRegistry Existing identity registry address
     * @param existingCompliance Existing compliance address
     * @param tokenAdmin Token admin address
     * @return token The deployed token proxy address
     */
    function deployTokenOnly(
        string calldata name,
        string calldata symbol,
        address existingRegistry,
        address existingCompliance,
        address tokenAdmin
    ) external onlyRole(Roles.FACTORY_ROLE) returns (address token) {
        require(bytes(name).length > 0, "TokenFactory: empty name");
        require(bytes(symbol).length > 0, "TokenFactory: empty symbol");
        require(existingRegistry != address(0), "TokenFactory: zero registry");
        require(existingCompliance != address(0), "TokenFactory: zero compliance");
        require(tokenAdmin != address(0), "TokenFactory: zero admin");

        _deploymentCounter++;

        token = _deployProxy(
            tokenImplementation,
            abi.encodeWithSelector(
                TokenUpgradeable.initialize.selector,
                name,
                symbol,
                existingRegistry,
                existingCompliance,
                tokenAdmin
            ),
            keccak256(abi.encodePacked("token-only", _deploymentCounter, block.timestamp))
        );

        _deployedTokens.push(token);
        _tokenDeployments[token] = TokenDeployment({
            token: token,
            identityRegistry: existingRegistry,
            compliance: existingCompliance,
            name: name,
            symbol: symbol,
            deployer: msg.sender,
            deployedAt: block.timestamp,
            exists: true
        });

        emit TokenSuiteDeployed(token, existingRegistry, existingCompliance, name, symbol, msg.sender);

        return token;
    }

    // ===== Internal Functions =====

    /**
     * @dev Deploys an ERC1967 proxy with CREATE2
     * @param implementation The implementation address
     * @param initData The initialization calldata
     * @param salt The salt for CREATE2
     */
    function _deployProxy(
        address implementation,
        bytes memory initData,
        bytes32 salt
    ) internal returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy{salt: salt}(implementation, initData);
        return address(proxy);
    }

    /**
     * @dev Computes the address of a proxy before deployment
     * @param implementation The implementation address
     * @param initData The initialization calldata
     * @param salt The salt for CREATE2
     */
    function computeProxyAddress(
        address implementation,
        bytes memory initData,
        bytes32 salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(implementation, initData)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }
}
