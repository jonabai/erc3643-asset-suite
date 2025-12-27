const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("TokenModule", (m) => {
  // Deploy IdentityRegistry
  const identityRegistry = m.contract("IdentityRegistry");

  // Deploy ModularCompliance
  const compliance = m.contract("ModularCompliance");

  // Deploy Token with dependencies
  const token = m.contract("Token", [
    "Security Token", // name
    "SEC", // symbol
    identityRegistry,
    compliance,
  ]);

  // Bind token to compliance
  m.call(compliance, "bindToken", [token]);

  // Deploy compliance modules
  const countryModule = m.contract("CountryRestrictModule");
  const maxBalanceModule = m.contract("MaxBalanceModule");

  // Add modules to compliance
  m.call(compliance, "addModule", [countryModule], { id: "addCountryModule" });
  m.call(compliance, "addModule", [maxBalanceModule], { id: "addMaxBalanceModule" });

  return {
    identityRegistry,
    compliance,
    token,
    countryModule,
    maxBalanceModule,
  };
});
