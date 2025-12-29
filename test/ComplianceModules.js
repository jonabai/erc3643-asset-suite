const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Compliance Modules", function () {
  async function deployModulesFixture() {
    const [owner, admin, complianceManager, investor1, investor2] = await hre.ethers.getSigners();

    // Deploy implementations
    const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
    const Compliance = await hre.ethers.getContractFactory("ModularCompliance");
    const Token = await hre.ethers.getContractFactory("Token");
    const CountryRestrictModule = await hre.ethers.getContractFactory("CountryRestrictModule");
    const MaxBalanceModule = await hre.ethers.getContractFactory("MaxBalanceModule");

    // Deploy proxies
    const identityRegistry = await hre.upgrades.deployProxy(
      IdentityRegistry,
      [admin.address],
      { kind: "uups" }
    );

    const compliance = await hre.upgrades.deployProxy(
      Compliance,
      [admin.address],
      { kind: "uups" }
    );

    const token = await hre.upgrades.deployProxy(
      Token,
      ["SecurityToken", "SEC", await identityRegistry.getAddress(), await compliance.getAddress(), admin.address],
      { kind: "uups" }
    );

    const countryRestrictModule = await hre.upgrades.deployProxy(
      CountryRestrictModule,
      [admin.address],
      { kind: "uups" }
    );

    const maxBalanceModule = await hre.upgrades.deployProxy(
      MaxBalanceModule,
      [admin.address],
      { kind: "uups" }
    );

    // Setup roles
    const AGENT_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("AGENT_ROLE"));
    const REGISTRY_MANAGER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REGISTRY_MANAGER_ROLE"));
    const COMPLIANCE_MANAGER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("COMPLIANCE_MANAGER_ROLE"));

    await token.connect(admin).grantRole(AGENT_ROLE, admin.address);
    await identityRegistry.connect(admin).grantRole(REGISTRY_MANAGER_ROLE, admin.address);
    await compliance.connect(admin).grantRole(COMPLIANCE_MANAGER_ROLE, complianceManager.address);
    await countryRestrictModule.connect(admin).grantRole(COMPLIANCE_MANAGER_ROLE, complianceManager.address);
    await maxBalanceModule.connect(admin).grantRole(COMPLIANCE_MANAGER_ROLE, complianceManager.address);

    // Bind token to compliance
    await compliance.connect(admin).bindToken(await token.getAddress());

    // Register investors (US = 840, UK = 826, Russia = 643)
    await identityRegistry.connect(admin).registerIdentity(investor1.address, investor1.address, 840);
    await identityRegistry.connect(admin).registerIdentity(investor2.address, investor2.address, 643);

    return {
      token,
      identityRegistry,
      compliance,
      countryRestrictModule,
      maxBalanceModule,
      owner,
      admin,
      complianceManager,
      investor1,
      investor2,
      COMPLIANCE_MANAGER_ROLE,
    };
  }

  describe("MaxBalanceModule", function () {
    it("Should set max balance", async function () {
      const { compliance, maxBalanceModule, complianceManager } = await loadFixture(deployModulesFixture);

      await maxBalanceModule.connect(complianceManager).setMaxBalance(
        await compliance.getAddress(),
        hre.ethers.parseEther("1000")
      );

      expect(await maxBalanceModule.getMaxBalance(await compliance.getAddress())).to.equal(
        hre.ethers.parseEther("1000")
      );
    });

    it("Should remove max balance (set to 0)", async function () {
      const { compliance, maxBalanceModule, complianceManager } = await loadFixture(deployModulesFixture);

      await maxBalanceModule.connect(complianceManager).setMaxBalance(
        await compliance.getAddress(),
        hre.ethers.parseEther("1000")
      );

      await maxBalanceModule.connect(complianceManager).removeMaxBalance(await compliance.getAddress());

      expect(await maxBalanceModule.getMaxBalance(await compliance.getAddress())).to.equal(0);
    });

    it("Should allow setting max balance to 0 (unlimited)", async function () {
      const { compliance, maxBalanceModule, complianceManager } = await loadFixture(deployModulesFixture);

      await maxBalanceModule.connect(complianceManager).setMaxBalance(
        await compliance.getAddress(),
        hre.ethers.parseEther("1000")
      );

      // Now set to 0 to disable
      await maxBalanceModule.connect(complianceManager).setMaxBalance(await compliance.getAddress(), 0);

      expect(await maxBalanceModule.getMaxBalance(await compliance.getAddress())).to.equal(0);
    });

    it("Should enforce max balance on transfers", async function () {
      const { token, compliance, maxBalanceModule, complianceManager, admin, investor1, investor2 } = await loadFixture(deployModulesFixture);

      // Mint tokens BEFORE adding module (no limit yet)
      await token.connect(admin).mint(investor1.address, hre.ethers.parseEther("1000"));

      // Add module to compliance
      await compliance.connect(complianceManager).addModule(await maxBalanceModule.getAddress());

      // Set max balance
      await maxBalanceModule.connect(complianceManager).setMaxBalance(
        await compliance.getAddress(),
        hre.ethers.parseEther("500")
      );

      // Transfer within limit should work
      await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("400"));

      // Transfer exceeding limit should fail (investor2 has 400, trying to add 200 = 600 > 500)
      await expect(
        token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("200"))
      ).to.be.revertedWith("Token: transfer not compliant");
    });

    it("Should allow transfers when max balance is removed", async function () {
      const { token, compliance, maxBalanceModule, complianceManager, admin, investor1, investor2 } = await loadFixture(deployModulesFixture);

      // Mint tokens BEFORE adding module (no limit yet)
      await token.connect(admin).mint(investor1.address, hre.ethers.parseEther("1000"));

      // Add module to compliance
      await compliance.connect(complianceManager).addModule(await maxBalanceModule.getAddress());

      // Set max balance
      await maxBalanceModule.connect(complianceManager).setMaxBalance(
        await compliance.getAddress(),
        hre.ethers.parseEther("500")
      );

      // Remove max balance
      await maxBalanceModule.connect(complianceManager).removeMaxBalance(await compliance.getAddress());

      // Now transfer should work (no limit)
      await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("900"));
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("900"));
    });
  });

  describe("CountryRestrictModule", function () {
    it("Should add country restriction", async function () {
      const { compliance, countryRestrictModule, complianceManager } = await loadFixture(deployModulesFixture);

      await countryRestrictModule.connect(complianceManager).addCountryRestriction(
        await compliance.getAddress(),
        643 // Russia
      );

      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 643)).to.be.true;
    });

    it("Should remove country restriction", async function () {
      const { compliance, countryRestrictModule, complianceManager } = await loadFixture(deployModulesFixture);

      await countryRestrictModule.connect(complianceManager).addCountryRestriction(
        await compliance.getAddress(),
        643
      );

      await countryRestrictModule.connect(complianceManager).removeCountryRestriction(
        await compliance.getAddress(),
        643
      );

      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 643)).to.be.false;
    });

    it("Should batch add country restrictions", async function () {
      const { compliance, countryRestrictModule, complianceManager } = await loadFixture(deployModulesFixture);

      await countryRestrictModule.connect(complianceManager).batchAddCountryRestrictions(
        await compliance.getAddress(),
        [643, 408, 156] // Russia, North Korea, China
      );

      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 643)).to.be.true;
      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 408)).to.be.true;
      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 156)).to.be.true;
    });

    it("Should batch remove country restrictions", async function () {
      const { compliance, countryRestrictModule, complianceManager } = await loadFixture(deployModulesFixture);

      // First add restrictions
      await countryRestrictModule.connect(complianceManager).batchAddCountryRestrictions(
        await compliance.getAddress(),
        [643, 408, 156]
      );

      // Then batch remove
      await countryRestrictModule.connect(complianceManager).batchRemoveCountryRestrictions(
        await compliance.getAddress(),
        [643, 408]
      );

      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 643)).to.be.false;
      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 408)).to.be.false;
      expect(await countryRestrictModule.isCountryRestricted(await compliance.getAddress(), 156)).to.be.true;
    });

    it("Should fail batch add with empty array", async function () {
      const { compliance, countryRestrictModule, complianceManager } = await loadFixture(deployModulesFixture);

      await expect(
        countryRestrictModule.connect(complianceManager).batchAddCountryRestrictions(
          await compliance.getAddress(),
          []
        )
      ).to.be.revertedWith("CountryRestrictModule: empty array");
    });

    it("Should fail batch remove with empty array", async function () {
      const { compliance, countryRestrictModule, complianceManager } = await loadFixture(deployModulesFixture);

      await expect(
        countryRestrictModule.connect(complianceManager).batchRemoveCountryRestrictions(
          await compliance.getAddress(),
          []
        )
      ).to.be.revertedWith("CountryRestrictModule: empty array");
    });

    it("Should block transfers to restricted countries", async function () {
      const { token, compliance, countryRestrictModule, complianceManager, admin, investor1, investor2 } = await loadFixture(deployModulesFixture);

      // Add module to compliance
      await compliance.connect(complianceManager).addModule(await countryRestrictModule.getAddress());

      // Restrict Russia (investor2's country)
      await countryRestrictModule.connect(complianceManager).addCountryRestriction(
        await compliance.getAddress(),
        643
      );

      // Mint tokens to investor1
      await token.connect(admin).mint(investor1.address, hre.ethers.parseEther("1000"));

      // Transfer to investor2 (Russia) should fail
      await expect(
        token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("Token: transfer not compliant");
    });

    it("Should allow transfers after country restriction removed", async function () {
      const { token, compliance, countryRestrictModule, complianceManager, admin, investor1, investor2 } = await loadFixture(deployModulesFixture);

      // Add module to compliance
      await compliance.connect(complianceManager).addModule(await countryRestrictModule.getAddress());

      // Restrict Russia
      await countryRestrictModule.connect(complianceManager).addCountryRestriction(
        await compliance.getAddress(),
        643
      );

      // Mint tokens
      await token.connect(admin).mint(investor1.address, hre.ethers.parseEther("1000"));

      // Remove restriction
      await countryRestrictModule.connect(complianceManager).removeCountryRestriction(
        await compliance.getAddress(),
        643
      );

      // Now transfer should work
      await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"));
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("100"));
    });
  });

  describe("Module Hook Validation", function () {
    it("Should reject moduleTransferAction from non-compliance caller", async function () {
      const { compliance, countryRestrictModule, investor1, investor2 } = await loadFixture(deployModulesFixture);

      await expect(
        countryRestrictModule.connect(investor1).moduleTransferAction(
          await compliance.getAddress(),
          investor1.address,
          investor2.address,
          hre.ethers.parseEther("100")
        )
      ).to.be.revertedWith("CountryRestrictModule: only compliance can call");
    });

    it("Should reject moduleMintAction from non-compliance caller", async function () {
      const { compliance, maxBalanceModule, investor1 } = await loadFixture(deployModulesFixture);

      await expect(
        maxBalanceModule.connect(investor1).moduleMintAction(
          await compliance.getAddress(),
          investor1.address,
          hre.ethers.parseEther("100")
        )
      ).to.be.revertedWith("MaxBalanceModule: only compliance can call");
    });

    it("Should reject moduleBurnAction from non-compliance caller", async function () {
      const { compliance, countryRestrictModule, investor1 } = await loadFixture(deployModulesFixture);

      await expect(
        countryRestrictModule.connect(investor1).moduleBurnAction(
          await compliance.getAddress(),
          investor1.address,
          hre.ethers.parseEther("100")
        )
      ).to.be.revertedWith("CountryRestrictModule: only compliance can call");
    });
  });
});
