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

  describe("Forced Transfer", function () {
    it("Should allow agent to force transfer tokens", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);
      const amount = hre.ethers.parseEther("1000");

      await token.connect(agent).mint(investor1.address, amount);

      await expect(token.connect(agent).forcedTransfer(investor1.address, investor2.address, hre.ethers.parseEther("100")))
        .to.emit(token, "Transfer")
        .withArgs(investor1.address, investor2.address, hre.ethers.parseEther("100"));

      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("100"));
      expect(await token.balanceOf(investor1.address)).to.equal(hre.ethers.parseEther("900"));
    });

    it("Should force transfer even from frozen address", async function () {
      const { token, agent, freezer, investor1, investor2 } = await loadFixture(deployTokenFixture);
      const amount = hre.ethers.parseEther("1000");

      await token.connect(agent).mint(investor1.address, amount);
      await token.connect(freezer).setAddressFrozen(investor1.address, true);

      // Normal transfer should fail
      await expect(
        token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("Token: address is frozen");

      // Forced transfer should succeed
      await token.connect(agent).forcedTransfer(investor1.address, investor2.address, hre.ethers.parseEther("100"));
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("100"));
    });

    it("Should force transfer frozen tokens and reduce frozen amount", async function () {
      const { token, agent, freezer, investor1, investor2 } = await loadFixture(deployTokenFixture);
      const amount = hre.ethers.parseEther("1000");

      await token.connect(agent).mint(investor1.address, amount);
      await token.connect(freezer).freezePartialTokens(investor1.address, hre.ethers.parseEther("500"));

      // Force transfer more than unfrozen balance
      await expect(token.connect(agent).forcedTransfer(investor1.address, investor2.address, hre.ethers.parseEther("700")))
        .to.emit(token, "TokensUnfrozen");

      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("700"));
      expect(await token.getFrozenTokens(investor1.address)).to.equal(hre.ethers.parseEther("300"));
    });

    it("Should fail forced transfer without AGENT_ROLE", async function () {
      const { token, agent, investor1, investor2, unregistered, AGENT_ROLE } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(token.connect(unregistered).forcedTransfer(investor1.address, investor2.address, hre.ethers.parseEther("100")))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(unregistered.address, AGENT_ROLE);
    });

    it("Should fail forced transfer to unverified address", async function () {
      const { token, agent, investor1, unregistered } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(agent).forcedTransfer(investor1.address, unregistered.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWith("Token: recipient not verified");
    });
  });

  describe("Batch Forced Transfer", function () {
    it("Should batch force transfer to multiple recipients", async function () {
      const { token, agent, identityRegistry, investor1, investor2, owner } = await loadFixture(deployTokenFixture);

      // Register owner as investor
      const REGISTRY_MANAGER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("REGISTRY_MANAGER_ROLE"));
      await identityRegistry.connect(agent).registerIdentity(owner.address, owner.address, 840);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await token.connect(agent).batchForcedTransfer(
        [investor1.address, investor1.address],
        [investor2.address, owner.address],
        [hre.ethers.parseEther("100"), hre.ethers.parseEther("200")]
      );

      expect(await token.balanceOf(investor1.address)).to.equal(hre.ethers.parseEther("700"));
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("100"));
      expect(await token.balanceOf(owner.address)).to.equal(hre.ethers.parseEther("200"));
    });

    it("Should fail batch forced transfer with mismatched arrays", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(agent).batchForcedTransfer(
          [investor1.address],
          [investor2.address, investor2.address],
          [hre.ethers.parseEther("100")]
        )
      ).to.be.revertedWith("Token: arrays length mismatch");
    });
  });

  describe("Batch Mint", function () {
    it("Should batch mint to multiple recipients", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).batchMint(
        [investor1.address, investor2.address],
        [hre.ethers.parseEther("1000"), hre.ethers.parseEther("500")]
      );

      expect(await token.balanceOf(investor1.address)).to.equal(hre.ethers.parseEther("1000"));
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("500"));
      expect(await token.totalSupply()).to.equal(hre.ethers.parseEther("1500"));
    });

    it("Should fail batch mint without AGENT_ROLE", async function () {
      const { token, investor1, investor2, unregistered, AGENT_ROLE } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(unregistered).batchMint(
          [investor1.address, investor2.address],
          [hre.ethers.parseEther("1000"), hre.ethers.parseEther("500")]
        )
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(unregistered.address, AGENT_ROLE);
    });

    it("Should fail batch mint with mismatched arrays", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(agent).batchMint(
          [investor1.address],
          [hre.ethers.parseEther("1000"), hre.ethers.parseEther("500")]
        )
      ).to.be.revertedWith("Token: arrays length mismatch");
    });

    it("Should fail batch mint to unverified address", async function () {
      const { token, agent, investor1, unregistered } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(agent).batchMint(
          [investor1.address, unregistered.address],
          [hre.ethers.parseEther("1000"), hre.ethers.parseEther("500")]
        )
      ).to.be.revertedWith("Token: recipient not verified");
    });

    it("Should fail batch mint when paused", async function () {
      const { token, admin, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(admin).pause();

      await expect(
        token.connect(agent).batchMint(
          [investor1.address, investor2.address],
          [hre.ethers.parseEther("1000"), hre.ethers.parseEther("500")]
        )
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("Allowance Functions", function () {
    it("Should increase allowance", async function () {
      const { token, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(investor1).approve(investor2.address, hre.ethers.parseEther("100"));
      expect(await token.allowance(investor1.address, investor2.address)).to.equal(hre.ethers.parseEther("100"));

      await token.connect(investor1).increaseAllowance(investor2.address, hre.ethers.parseEther("50"));
      expect(await token.allowance(investor1.address, investor2.address)).to.equal(hre.ethers.parseEther("150"));
    });

    it("Should decrease allowance", async function () {
      const { token, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(investor1).approve(investor2.address, hre.ethers.parseEther("100"));

      await token.connect(investor1).decreaseAllowance(investor2.address, hre.ethers.parseEther("30"));
      expect(await token.allowance(investor1.address, investor2.address)).to.equal(hre.ethers.parseEther("70"));
    });

    it("Should fail to decrease allowance below zero", async function () {
      const { token, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(investor1).approve(investor2.address, hre.ethers.parseEther("100"));

      await expect(
        token.connect(investor1).decreaseAllowance(investor2.address, hre.ethers.parseEther("150"))
      ).to.be.revertedWith("Token: decreased allowance below zero");
    });

    it("Should fail approve when paused", async function () {
      const { token, admin, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(admin).pause();

      await expect(
        token.connect(investor1).approve(investor2.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should fail increaseAllowance when paused", async function () {
      const { token, admin, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(investor1).approve(investor2.address, hre.ethers.parseEther("100"));
      await token.connect(admin).pause();

      await expect(
        token.connect(investor1).increaseAllowance(investor2.address, hre.ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should fail decreaseAllowance when paused", async function () {
      const { token, admin, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(investor1).approve(investor2.address, hre.ethers.parseEther("100"));
      await token.connect(admin).pause();

      await expect(
        token.connect(investor1).decreaseAllowance(investor2.address, hre.ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("Recovery Address", function () {
    it("Should recover tokens and transfer frozen status", async function () {
      const { token, agent, freezer, identityRegistry, investor1, investor2 } = await loadFixture(deployTokenFixture);

      // Use same identity for both wallets (simulating wallet recovery)
      const sharedIdentity = investor1.address;

      // Update investor2 to have same identity as investor1
      await identityRegistry.connect(agent).updateIdentity(investor2.address, sharedIdentity);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
      await token.connect(freezer).setAddressFrozen(investor1.address, true);
      await token.connect(freezer).freezePartialTokens(investor1.address, hre.ethers.parseEther("300"));

      await token.connect(agent).recoveryAddress(investor1.address, investor2.address, sharedIdentity);

      // Check balances
      expect(await token.balanceOf(investor1.address)).to.equal(0);
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("1000"));

      // Check frozen status transferred
      expect(await token.isFrozen(investor1.address)).to.be.false;
      expect(await token.isFrozen(investor2.address)).to.be.true;

      // Check frozen tokens transferred
      expect(await token.getFrozenTokens(investor1.address)).to.equal(0);
      expect(await token.getFrozenTokens(investor2.address)).to.equal(hre.ethers.parseEther("300"));
    });

    it("Should fail recovery if lost wallet identity mismatch", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      // Try to recover with wrong identity for lost wallet
      await expect(
        token.connect(agent).recoveryAddress(investor1.address, investor2.address, investor2.address)
      ).to.be.revertedWith("Token: lost wallet identity mismatch");
    });

    it("Should fail recovery if new wallet identity mismatch", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      // investor1 and investor2 have different identities
      await expect(
        token.connect(agent).recoveryAddress(investor1.address, investor2.address, investor1.address)
      ).to.be.revertedWith("Token: new wallet identity mismatch");
    });

    it("Should fail recovery to same wallet", async function () {
      const { token, agent, investor1 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(agent).recoveryAddress(investor1.address, investor1.address, investor1.address)
      ).to.be.revertedWith("Token: same wallet");
    });
  });

  describe("Zero Amount Checks", function () {
    it("Should fail transfer with zero amount", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(investor1).transfer(investor2.address, 0)
      ).to.be.revertedWith("Token: zero amount");
    });

    it("Should fail mint with zero amount", async function () {
      const { token, agent, investor1 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(agent).mint(investor1.address, 0)
      ).to.be.revertedWith("Token: zero amount");
    });

    it("Should fail burn with zero amount", async function () {
      const { token, agent, investor1 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(agent).burn(investor1.address, 0)
      ).to.be.revertedWith("Token: zero amount");
    });

    it("Should fail forced transfer with zero amount", async function () {
      const { token, agent, investor1, investor2 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

      await expect(
        token.connect(agent).forcedTransfer(investor1.address, investor2.address, 0)
      ).to.be.revertedWith("Token: zero amount");
    });
  });

  describe("Empty Array Checks", function () {
    it("Should fail batch transfer with empty arrays", async function () {
      const { token, investor1 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(investor1).batchTransfer([], [])
      ).to.be.revertedWith("Token: empty arrays");
    });

    it("Should fail batch mint with empty arrays", async function () {
      const { token, agent } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(agent).batchMint([], [])
      ).to.be.revertedWith("Token: empty arrays");
    });

    it("Should fail batch forced transfer with empty arrays", async function () {
      const { token, agent } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(agent).batchForcedTransfer([], [], [])
      ).to.be.revertedWith("Token: empty arrays");
    });
  });

  describe("Burn Pause Check", function () {
    it("Should fail burn when paused", async function () {
      const { token, admin, agent, investor1 } = await loadFixture(deployTokenFixture);

      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
      await token.connect(admin).pause();

      await expect(
        token.connect(agent).burn(investor1.address, hre.ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });
});
