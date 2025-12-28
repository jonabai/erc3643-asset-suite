const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Token", function () {
  async function deployTokenFixture() {
    const [owner, admin, agent, freezer, investor1, investor2, unregistered] = await hre.ethers.getSigners();

    // Deploy implementations
    const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
    const identityRegistryImpl = await IdentityRegistry.deploy();

    const Compliance = await hre.ethers.getContractFactory("ModularCompliance");
    const complianceImpl = await Compliance.deploy();

    const Token = await hre.ethers.getContractFactory("Token");
    const tokenImpl = await Token.deploy();

    // Deploy proxies using upgrades plugin
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

    // Setup roles
    const AGENT_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("AGENT_ROLE"));
    const FREEZER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("FREEZER_ROLE"));
    const REGISTRY_MANAGER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REGISTRY_MANAGER_ROLE"));
    const COMPLIANCE_MANAGER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("COMPLIANCE_MANAGER_ROLE"));

    await token.connect(admin).grantRole(AGENT_ROLE, agent.address);
    await token.connect(admin).grantRole(FREEZER_ROLE, freezer.address);
    await identityRegistry.connect(admin).grantRole(REGISTRY_MANAGER_ROLE, agent.address);
    await compliance.connect(admin).grantRole(COMPLIANCE_MANAGER_ROLE, admin.address);

    // Bind token to compliance
    await compliance.connect(admin).bindToken(await token.getAddress());

    // Register investors
    await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, 840);
    await identityRegistry.connect(agent).registerIdentity(investor2.address, investor2.address, 826);

    return {
      token,
      identityRegistry,
      compliance,
      tokenImpl,
      owner,
      admin,
      agent,
      freezer,
      investor1,
      investor2,
      unregistered,
      AGENT_ROLE,
      FREEZER_ROLE,
    };
  }

  describe("Deployment", function () {
    it("Should initialize correctly", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal("SecurityToken");
      expect(await token.symbol()).to.equal("SEC");
      expect(await token.decimals()).to.equal(18);
      expect(await token.version()).to.equal("1.0.0");
    });

    it("Should set correct roles", async function () {
      const { token, admin, agent, AGENT_ROLE } = await loadFixture(deployTokenFixture);

      expect(await token.hasRole(AGENT_ROLE, agent.address)).to.be.true;
    });

    it("Should not allow reinitialization", async function () {
      const { token, admin, identityRegistry, compliance } = await loadFixture(deployTokenFixture);

      await expect(
        token.initialize(
          "NewToken",
          "NEW",
          await identityRegistry.getAddress(),
          await compliance.getAddress(),
          admin.address
        )
      ).to.be.revertedWithCustomError(token, "InvalidInitialization");
    });
  });

  describe("Minting", function () {
    it("Should allow agent to mint tokens", async function () {
      const { token, agent, investor1 } = await loadFixture(deployTokenFixture);
      const amount = hre.ethers.parseEther("1000");

      await expect(token.connect(agent).mint(investor1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(hre.ethers.ZeroAddress, investor1.address, amount);

      expect(await token.balanceOf(investor1.address)).to.equal(amount);
    });

    it("Should fail to mint without AGENT_ROLE", async function () {
      const { token, investor1, unregistered, AGENT_ROLE } = await loadFixture(deployTokenFixture);

      await expect(token.connect(unregistered).mint(investor1.address, 100))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(unregistered.address, AGENT_ROLE);
    });
  });

  describe("Transfers", function () {
    it("Should transfer between verified investors", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
      await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"));

      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("100"));
    });

    it("Should fail transfer to unverified address", async function () {
      const { token, agent, investor1, unregistered } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(investor1).transfer(unregistered.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("Token: recipient not verified");
    });
  });

  describe("Freezing", function () {
    it("Should allow freezer to freeze address", async function () {
      const { token, freezer, investor1 } = await loadFixture(deployTokenFixture);

      await expect(token.connect(freezer).setAddressFrozen(investor1.address, true))
        .to.emit(token, "AddressFrozen")
        .withArgs(investor1.address, true, freezer.address);

      expect(await token.isFrozen(investor1.address)).to.be.true;
    });

    it("Should prevent frozen address from transferring", async function () {
      const { token, agent, freezer, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
      await token.connect(freezer).setAddressFrozen(investor1.address, true);

      await expect(
        token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("Token: address is frozen");
    });
  });

  describe("Pause", function () {
    it("Should pause and unpause", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);

      await token.connect(admin).pause();
      expect(await token.paused()).to.be.true;

      await token.connect(admin).unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      const { token, admin, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
      await token.connect(admin).pause();

      await expect(
        token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("Upgradeability", function () {
    it("Should upgrade to new implementation", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);

      // Deploy new implementation (same contract for testing) - connect as admin who has UPGRADER_ROLE
      const TokenV2 = await hre.ethers.getContractFactory("Token", admin);

      // Upgrade
      const upgraded = await hre.upgrades.upgradeProxy(await token.getAddress(), TokenV2);

      expect(await upgraded.name()).to.equal("SecurityToken");
      expect(await upgraded.version()).to.equal("1.0.0");
    });

    it("Should fail upgrade without UPGRADER_ROLE", async function () {
      const { token, investor1 } = await loadFixture(deployTokenFixture);

      const TokenV2 = await hre.ethers.getContractFactory("Token", investor1);
      const newImpl = await TokenV2.deploy();

      const UPGRADER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("UPGRADER_ROLE"));

      await expect(token.connect(investor1).upgradeToAndCall(await newImpl.getAddress(), "0x"))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(investor1.address, UPGRADER_ROLE);
    });
  });
});
