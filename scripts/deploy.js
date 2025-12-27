const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy IdentityRegistry
  console.log("\n1. Deploying IdentityRegistry...");
  const identityRegistry = await hre.ethers.deployContract("IdentityRegistry");
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("   IdentityRegistry deployed to:", identityRegistryAddress);

  // Deploy ModularCompliance
  console.log("\n2. Deploying ModularCompliance...");
  const compliance = await hre.ethers.deployContract("ModularCompliance");
  await compliance.waitForDeployment();
  const complianceAddress = await compliance.getAddress();
  console.log("   ModularCompliance deployed to:", complianceAddress);

  // Deploy Token
  console.log("\n3. Deploying Token...");
  const tokenName = "Security Token";
  const tokenSymbol = "SEC";
  const token = await hre.ethers.deployContract("Token", [
    tokenName,
    tokenSymbol,
    identityRegistryAddress,
    complianceAddress,
  ]);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("   Token deployed to:", tokenAddress);

  // Bind token to compliance
  console.log("\n4. Binding token to compliance...");
  await compliance.bindToken(tokenAddress);
  console.log("   Token bound to compliance");

  // Deploy compliance modules
  console.log("\n5. Deploying CountryRestrictModule...");
  const countryModule = await hre.ethers.deployContract("CountryRestrictModule");
  await countryModule.waitForDeployment();
  const countryModuleAddress = await countryModule.getAddress();
  console.log("   CountryRestrictModule deployed to:", countryModuleAddress);

  console.log("\n6. Deploying MaxBalanceModule...");
  const maxBalanceModule = await hre.ethers.deployContract("MaxBalanceModule");
  await maxBalanceModule.waitForDeployment();
  const maxBalanceModuleAddress = await maxBalanceModule.getAddress();
  console.log("   MaxBalanceModule deployed to:", maxBalanceModuleAddress);

  // Add modules to compliance
  console.log("\n7. Adding modules to compliance...");
  await compliance.addModule(countryModuleAddress);
  await compliance.addModule(maxBalanceModuleAddress);
  console.log("   Modules added to compliance");

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Token Name:", tokenName);
  console.log("Token Symbol:", tokenSymbol);
  console.log("\nContract Addresses:");
  console.log("  IdentityRegistry:", identityRegistryAddress);
  console.log("  ModularCompliance:", complianceAddress);
  console.log("  Token:", tokenAddress);
  console.log("  CountryRestrictModule:", countryModuleAddress);
  console.log("  MaxBalanceModule:", maxBalanceModuleAddress);
  console.log("========================================\n");

  return {
    identityRegistry: identityRegistryAddress,
    compliance: complianceAddress,
    token: tokenAddress,
    countryModule: countryModuleAddress,
    maxBalanceModule: maxBalanceModuleAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
