const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying upgradeable contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)));

  // ===== Deploy Implementations =====
  console.log("\n========== DEPLOYING IMPLEMENTATIONS ==========\n");

  console.log("1. Deploying TokenUpgradeable implementation...");
  const TokenUpgradeable = await hre.ethers.getContractFactory("TokenUpgradeable");
  const tokenImpl = await TokenUpgradeable.deploy();
  await tokenImpl.waitForDeployment();
  console.log("   TokenUpgradeable implementation:", await tokenImpl.getAddress());

  console.log("2. Deploying IdentityRegistryUpgradeable implementation...");
  const IdentityRegistryUpgradeable = await hre.ethers.getContractFactory("IdentityRegistryUpgradeable");
  const registryImpl = await IdentityRegistryUpgradeable.deploy();
  await registryImpl.waitForDeployment();
  console.log("   IdentityRegistryUpgradeable implementation:", await registryImpl.getAddress());

  console.log("3. Deploying ModularComplianceUpgradeable implementation...");
  const ModularComplianceUpgradeable = await hre.ethers.getContractFactory("ModularComplianceUpgradeable");
  const complianceImpl = await ModularComplianceUpgradeable.deploy();
  await complianceImpl.waitForDeployment();
  console.log("   ModularComplianceUpgradeable implementation:", await complianceImpl.getAddress());

  console.log("4. Deploying CountryRestrictModuleUpgradeable implementation...");
  const CountryRestrictModuleUpgradeable = await hre.ethers.getContractFactory("CountryRestrictModuleUpgradeable");
  const countryModuleImpl = await CountryRestrictModuleUpgradeable.deploy();
  await countryModuleImpl.waitForDeployment();
  console.log("   CountryRestrictModuleUpgradeable implementation:", await countryModuleImpl.getAddress());

  console.log("5. Deploying MaxBalanceModuleUpgradeable implementation...");
  const MaxBalanceModuleUpgradeable = await hre.ethers.getContractFactory("MaxBalanceModuleUpgradeable");
  const maxBalanceModuleImpl = await MaxBalanceModuleUpgradeable.deploy();
  await maxBalanceModuleImpl.waitForDeployment();
  console.log("   MaxBalanceModuleUpgradeable implementation:", await maxBalanceModuleImpl.getAddress());

  // ===== Deploy TokenFactory =====
  console.log("\n========== DEPLOYING TOKEN FACTORY ==========\n");

  console.log("6. Deploying TokenFactory proxy...");
  const TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
  const factory = await hre.upgrades.deployProxy(
    TokenFactory,
    [deployer.address, await tokenImpl.getAddress(), await registryImpl.getAddress(), await complianceImpl.getAddress()],
    { kind: "uups" }
  );
  await factory.waitForDeployment();
  console.log("   TokenFactory proxy:", await factory.getAddress());

  // ===== Deploy Sample Token Suite =====
  console.log("\n========== DEPLOYING SAMPLE TOKEN SUITE ==========\n");

  console.log("7. Deploying sample Security Token suite via factory...");
  const tx = await factory.deployTokenSuite({
    name: "Security Token",
    symbol: "SEC",
    tokenAdmin: deployer.address,
    registryAdmin: deployer.address,
    complianceAdmin: deployer.address,
  });
  const receipt = await tx.wait();

  // Get deployed addresses from event
  const deployedTokens = await factory.getDeployedTokens();
  const deployment = await factory.getTokenDeployment(deployedTokens[0]);

  console.log("   Token proxy:", deployment.token);
  console.log("   IdentityRegistry proxy:", deployment.identityRegistry);
  console.log("   Compliance proxy:", deployment.compliance);

  // ===== Deploy Compliance Modules =====
  console.log("\n========== DEPLOYING COMPLIANCE MODULES ==========\n");

  console.log("8. Deploying CountryRestrictModule proxy...");
  const countryModule = await hre.upgrades.deployProxy(CountryRestrictModuleUpgradeable, [deployer.address], {
    kind: "uups",
  });
  await countryModule.waitForDeployment();
  console.log("   CountryRestrictModule proxy:", await countryModule.getAddress());

  console.log("9. Deploying MaxBalanceModule proxy...");
  const maxBalanceModule = await hre.upgrades.deployProxy(MaxBalanceModuleUpgradeable, [deployer.address], {
    kind: "uups",
  });
  await maxBalanceModule.waitForDeployment();
  console.log("   MaxBalanceModule proxy:", await maxBalanceModule.getAddress());

  // ===== Add Modules to Compliance =====
  console.log("\n========== CONFIGURING COMPLIANCE ==========\n");

  const compliance = await hre.ethers.getContractAt("ModularComplianceUpgradeable", deployment.compliance);

  console.log("10. Adding compliance modules...");
  await compliance.addModule(await countryModule.getAddress());
  await compliance.addModule(await maxBalanceModule.getAddress());
  console.log("    Modules added to compliance");

  // ===== Summary =====
  console.log("\n==========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("==========================================\n");

  console.log("IMPLEMENTATIONS:");
  console.log("  TokenUpgradeable:", await tokenImpl.getAddress());
  console.log("  IdentityRegistryUpgradeable:", await registryImpl.getAddress());
  console.log("  ModularComplianceUpgradeable:", await complianceImpl.getAddress());
  console.log("  CountryRestrictModuleUpgradeable:", await countryModuleImpl.getAddress());
  console.log("  MaxBalanceModuleUpgradeable:", await maxBalanceModuleImpl.getAddress());

  console.log("\nFACTORY:");
  console.log("  TokenFactory proxy:", await factory.getAddress());

  console.log("\nSAMPLE TOKEN SUITE:");
  console.log("  Token proxy:", deployment.token);
  console.log("  IdentityRegistry proxy:", deployment.identityRegistry);
  console.log("  Compliance proxy:", deployment.compliance);

  console.log("\nCOMPLIANCE MODULES:");
  console.log("  CountryRestrictModule proxy:", await countryModule.getAddress());
  console.log("  MaxBalanceModule proxy:", await maxBalanceModule.getAddress());

  console.log("\nADMIN:", deployer.address);
  console.log("==========================================\n");

  // Return addresses for verification
  return {
    implementations: {
      token: await tokenImpl.getAddress(),
      identityRegistry: await registryImpl.getAddress(),
      compliance: await complianceImpl.getAddress(),
      countryModule: await countryModuleImpl.getAddress(),
      maxBalanceModule: await maxBalanceModuleImpl.getAddress(),
    },
    factory: await factory.getAddress(),
    tokenSuite: {
      token: deployment.token,
      identityRegistry: deployment.identityRegistry,
      compliance: deployment.compliance,
    },
    modules: {
      countryRestrict: await countryModule.getAddress(),
      maxBalance: await maxBalanceModule.getAddress(),
    },
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
