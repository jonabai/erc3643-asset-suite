# ERC-3643 Asset Suite

A comprehensive suite of smart contracts implementing the ERC-3643 standard (T-REX - Token for Regulated Exchanges) for managing regulated security tokens on EVM blockchains.

## Overview

ERC-3643 is a standard for security tokens that enables compliant token transfers. This suite includes:

- **Token**: ERC-20 compatible security token with compliance hooks
- **Identity Registry**: Manages investor identities and verification
- **Modular Compliance**: Flexible compliance rules via pluggable modules
- **Compliance Modules**: Pre-built modules for common regulations
- **Token Factory**: Deploy multiple tokens from a single factory
- **UUPS Upgradeability**: All contracts are upgradeable via proxy pattern
- **Role-Based Access Control**: Granular permissions for different operations

## Project Structure

```
erc3643-asset-suite/
├── contracts/
│   ├── token/
│   │   ├── Token.sol                         # Legacy ERC-3643 token
│   │   └── TokenUpgradeable.sol              # UUPS upgradeable token
│   ├── registry/
│   │   ├── IdentityRegistry.sol              # Legacy identity registry
│   │   └── IdentityRegistryUpgradeable.sol   # UUPS upgradeable registry
│   ├── compliance/
│   │   ├── ModularCompliance.sol             # Legacy compliance
│   │   ├── ModularComplianceUpgradeable.sol  # UUPS upgradeable compliance
│   │   └── modules/
│   │       ├── CountryRestrictModule.sol
│   │       ├── CountryRestrictModuleUpgradeable.sol
│   │       ├── MaxBalanceModule.sol
│   │       └── MaxBalanceModuleUpgradeable.sol
│   ├── factory/
│   │   └── TokenFactory.sol                  # Token deployment factory
│   ├── interfaces/                           # Contract interfaces
│   └── Roles.sol                             # Access control roles
├── test/
│   ├── token/                                # Legacy tests
│   ├── registry/
│   ├── compliance/
│   └── upgradeable/                          # Upgradeable contract tests
├── scripts/
│   ├── deploy.js                             # Legacy deployment
│   └── deploy-upgradeable.js                 # Upgradeable deployment
└── SECURITY.md                               # Security & audit docs
```

## Access Control Roles

The suite uses role-based access control with the following roles:

| Role | Description |
|------|-------------|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `ADMIN_ROLE` | Contract configuration |
| `UPGRADER_ROLE` | Upgrade contract implementations |
| `AGENT_ROLE` | Mint, burn, wallet recovery |
| `FREEZER_ROLE` | Freeze/unfreeze addresses and tokens |
| `COMPLIANCE_MANAGER_ROLE` | Add/remove compliance modules |
| `REGISTRY_MANAGER_ROLE` | Register/update investor identities |
| `EMERGENCY_ROLE` | Pause/unpause operations |
| `FACTORY_ROLE` | Deploy new token suites |

## Prerequisites

- Node.js >= 18
- npm >= 9

## Installation

```bash
npm install
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile contracts |
| `npm run test` | Run all tests (86 tests) |
| `npm run test:upgradeable` | Run upgradeable contract tests |
| `npm run test:legacy` | Run legacy contract tests |
| `npm run test:gas` | Run tests with gas reporting |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Lint Solidity files |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run node` | Start local Hardhat node |
| `npm run deploy:local` | Deploy legacy contracts locally |
| `npm run deploy:local:upgradeable` | Deploy upgradeable contracts locally |
| `npm run deploy:amoy` | Deploy upgradeable to Polygon Amoy |
| `npm run deploy:polygon` | Deploy upgradeable to Polygon mainnet |
| `npm run deploy:sepolia` | Deploy upgradeable to Sepolia |
| `npm run deploy:mainnet` | Deploy upgradeable to Ethereum mainnet |
| `npm run verify` | Verify contracts on block explorer |
| `npm run clean` | Clean build artifacts |

## Usage Examples

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm run test

# With gas reporting
npm run test:gas
```

### Deploy to Local Network

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### Manual Deployment

```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Deploy to Real Networks (Polygon, Ethereum, etc.)

#### 1. Environment Setup

Create a `.env` file in the project root:

```bash
# Private key of the deployer account (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs (get from Alchemy, Infura, or public endpoints)
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key

# Block explorer API keys (for contract verification)
POLYGONSCAN_API_KEY=your_polygonscan_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

> **Security**: Never commit your `.env` file. It's already in `.gitignore`.

#### 2. Network Configuration

The `hardhat.config.js` includes configurations for:

| Network | Chain ID | Description |
|---------|----------|-------------|
| `polygon` | 137 | Polygon Mainnet |
| `amoy` | 80002 | Polygon Amoy Testnet |
| `mainnet` | 1 | Ethereum Mainnet |
| `sepolia` | 11155111 | Ethereum Sepolia Testnet |

#### 3. Get Test Tokens

For testnets, get free tokens from faucets:
- **Polygon Amoy**: https://faucet.polygon.technology/
- **Sepolia**: https://sepoliafaucet.com/

#### 4. Deploy to Testnet (Recommended First)

```bash
# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network amoy

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia
```

#### 5. Deploy to Mainnet

```bash
# Deploy to Polygon Mainnet
npx hardhat run scripts/deploy.js --network polygon

# Deploy to Ethereum Mainnet
npx hardhat run scripts/deploy.js --network mainnet
```

#### 6. Verify Contracts on Block Explorer

After deployment, verify your contracts for transparency:

```bash
# Verify on Polygonscan (replace with your contract addresses)
npx hardhat verify --network polygon <IDENTITY_REGISTRY_ADDRESS>
npx hardhat verify --network polygon <COMPLIANCE_ADDRESS>
npx hardhat verify --network polygon <TOKEN_ADDRESS> "Security Token" "SEC" <IDENTITY_REGISTRY_ADDRESS> <COMPLIANCE_ADDRESS>

# Verify on Etherscan
npx hardhat verify --network mainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

#### 7. Using Hardhat Ignition for Production

```bash
# Deploy with Ignition (tracks deployment state)
npx hardhat ignition deploy ./ignition/modules/Token.js --network polygon

# Resume a failed deployment
npx hardhat ignition deploy ./ignition/modules/Token.js --network polygon --deployment-id <ID>
```

#### Deployment Checklist

- [ ] Test thoroughly on local network first
- [ ] Deploy to testnet and verify functionality
- [ ] Ensure deployer wallet has sufficient native tokens for gas
- [ ] Double-check all constructor parameters
- [ ] Verify contracts on block explorer
- [ ] Document deployed contract addresses
- [ ] Transfer ownership if using a multisig

## Contract Overview

### Token (ERC-3643)

The main security token contract with:
- ERC-20 compatibility
- Transfer compliance checks
- Address freezing (full and partial)
- Pause functionality
- Agent-based access control
- Batch transfers
- Recovery mechanism for lost wallets

```solidity
// Example: Minting tokens
token.mint(investorAddress, amount);

// Example: Freezing an address
token.setAddressFrozen(userAddress, true);

// Example: Batch transfer
token.batchTransfer([addr1, addr2], [amount1, amount2]);
```

### Identity Registry

Manages investor identities:
- Register/update/delete investor identities
- Store country codes (ISO 3166-1 numeric)
- Verify investor registration status
- Agent-based management

```solidity
// Register an investor
identityRegistry.registerIdentity(
    investorAddress,
    onchainIdAddress,
    840  // USA country code
);

// Check if verified
bool verified = identityRegistry.isVerified(investorAddress);
```

### Modular Compliance

Flexible compliance engine supporting multiple modules:

```solidity
// Add a compliance module
compliance.addModule(moduleAddress);

// Check if transfer is compliant
bool canTransfer = compliance.canTransfer(from, to, amount);
```

### Compliance Modules

#### CountryRestrictModule
Restricts transfers based on investor country:

```solidity
// Restrict a country
countryModule.addCountryRestriction(complianceAddress, 999);

// Remove restriction
countryModule.removeCountryRestriction(complianceAddress, 999);
```

#### MaxBalanceModule
Limits maximum token holdings per investor:

```solidity
// Set max balance (500 tokens)
maxBalanceModule.setMaxBalance(complianceAddress, 500e18);
```

## Architecture

```
┌─────────────────┐
│     Token       │ ◄─── ERC-20 + Compliance Hooks
└────────┬────────┘
         │
    ┌────▼────┐        ┌──────────────────┐
    │Compliance│◄──────│ Identity Registry│
    └────┬────┘        └──────────────────┘
         │
    ┌────▼────────────────────┐
    │   Compliance Modules    │
    ├─────────────────────────┤
    │ • CountryRestrictModule │
    │ • MaxBalanceModule      │
    │ • (Add your own...)     │
    └─────────────────────────┘
```

### Upgradeable Architecture (Production)

```
┌──────────────────────────────────────────────────┐
│                  TokenFactory                     │
│  (deploys complete token suites via proxies)     │
└──────────────────┬───────────────────────────────┘
                   │ deploys
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────┐   ┌──────────┐   ┌────────────┐
│ Token  │   │ Identity │   │ Compliance │
│ Proxy  │   │ Registry │   │   Proxy    │
│        │   │  Proxy   │   │            │
└───┬────┘   └────┬─────┘   └─────┬──────┘
    │             │               │
    ▼             ▼               ▼
┌────────┐   ┌──────────┐   ┌────────────┐
│ Token  │   │ Registry │   │ Compliance │
│  Impl  │   │   Impl   │   │    Impl    │
│  v1.0  │   │   v1.0   │   │    v1.0    │
└────────┘   └──────────┘   └────────────┘
```

## Token Factory Usage

Deploy multiple security tokens using the factory:

```solidity
// Deploy a complete token suite (token + registry + compliance)
(address token, address registry, address compliance) = factory.deployTokenSuite({
    name: "Security Token",
    symbol: "SEC",
    tokenAdmin: adminAddress,
    registryAdmin: adminAddress,
    complianceAdmin: adminAddress
});

// Deploy token with existing infrastructure
address newToken = factory.deployTokenOnly(
    "Another Token",
    "ANT",
    existingRegistry,
    existingCompliance,
    adminAddress
);

// Get all deployed tokens
address[] memory tokens = factory.getDeployedTokens();
```

## Upgrading Contracts

Upgrade implementations without migrating data:

```javascript
const { upgrades } = require("hardhat");

// Deploy new implementation
const TokenV2 = await ethers.getContractFactory("TokenUpgradeableV2");

// Upgrade (must have UPGRADER_ROLE)
await upgrades.upgradeProxy(tokenProxyAddress, TokenV2);
```

**Important**: Always test upgrades on testnet first and follow the checklist in `SECURITY.md`.

## Creating Custom Compliance Modules

Implement the `IComplianceModule` interface:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IComplianceModule.sol";

contract MyCustomModule is IComplianceModule {
    function name() external pure returns (string memory) {
        return "MyCustomModule";
    }

    function moduleCheck(
        address _compliance,
        address _from,
        address _to,
        uint256 _value
    ) external view returns (bool) {
        // Your compliance logic here
        return true;
    }

    function moduleTransferAction(
        address _compliance,
        address _from,
        address _to,
        uint256 _value
    ) external {
        // Post-transfer actions (optional)
    }

    function moduleMintAction(address _compliance, address _to, uint256 _value) external {}
    function moduleBurnAction(address _compliance, address _from, uint256 _value) external {}
    function isPlugAndPlay(address _compliance) external pure returns (bool) { return true; }
}
```

## Testing

The test suite covers:
- Token deployment and configuration
- Minting and burning
- Transfers and allowances
- Freezing (full and partial)
- Pause functionality
- Identity registration and management
- Compliance module integration
- Country restrictions
- Maximum balance limits

Run all tests:
```bash
npm run test
```

Generate coverage report:
```bash
npm run test:coverage
```

## Development Tools

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Formatting

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

## IntelliJ IDEA Setup

1. Open the project in IntelliJ IDEA
2. Install the "Solidity" plugin (Settings > Plugins)
3. Configure Solidity SDK:
   - Settings > Languages & Frameworks > Solidity
   - Set SDK path to `node_modules/solc`
4. Enable Prettier:
   - Settings > Languages & Frameworks > JavaScript > Prettier
   - Check "On save"

## License

MIT

## References

- [ERC-3643 Specification](https://eips.ethereum.org/EIPS/eip-3643)
- [T-REX Documentation](https://tokeny.com/t-rex-security-token/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
