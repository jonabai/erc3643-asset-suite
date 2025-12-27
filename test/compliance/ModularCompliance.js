const { expect } = require("chai");
const hre = require("hardhat");

describe("ModularCompliance", function () {
  let compliance;
  let token;
  let identityRegistry;
  let countryModule;
  let maxBalanceModule;
  let owner;
  let agent;
  let investor1;
  let investor2;

  const NAME = "SecurityToken";
  const SYMBOL = "SEC";
  const COUNTRY_US = 840;
  const COUNTRY_UK = 826;
  const COUNTRY_RESTRICTED = 999;

  beforeEach(async function () {
    [owner, agent, investor1, investor2] = await hre.ethers.getSigners();

    // Deploy IdentityRegistry
    identityRegistry = await hre.ethers.deployContract("IdentityRegistry");
    await identityRegistry.waitForDeployment();

    // Deploy ModularCompliance
    compliance = await hre.ethers.deployContract("ModularCompliance");
    await compliance.waitForDeployment();

    // Deploy Token
    token = await hre.ethers.deployContract("Token", [
      NAME,
      SYMBOL,
      await identityRegistry.getAddress(),
      await compliance.getAddress(),
    ]);
    await token.waitForDeployment();

    // Bind token to compliance
    await compliance.bindToken(await token.getAddress());

    // Deploy compliance modules
    countryModule = await hre.ethers.deployContract("CountryRestrictModule");
    await countryModule.waitForDeployment();

    maxBalanceModule = await hre.ethers.deployContract("MaxBalanceModule");
    await maxBalanceModule.waitForDeployment();

    // Setup agents
    await token.addAgent(agent.address);
    await identityRegistry.addAgent(agent.address);

    // Register investors
    await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, COUNTRY_US);
    await identityRegistry.connect(agent).registerIdentity(investor2.address, investor2.address, COUNTRY_UK);
  });

  describe("Deployment", function () {
    it("Should set the owner correctly", async function () {
      expect(await compliance.owner()).to.equal(owner.address);
    });

    it("Should have the token bound", async function () {
      expect(await compliance.getTokenBound()).to.equal(await token.getAddress());
    });
  });

  describe("Module Management", function () {
    it("Should add a module", async function () {
      await expect(compliance.addModule(await countryModule.getAddress()))
        .to.emit(compliance, "ModuleAdded")
        .withArgs(await countryModule.getAddress());

      expect(await compliance.isModuleBound(await countryModule.getAddress())).to.be.true;
    });

    it("Should remove a module", async function () {
      await compliance.addModule(await countryModule.getAddress());

      await expect(compliance.removeModule(await countryModule.getAddress()))
        .to.emit(compliance, "ModuleRemoved")
        .withArgs(await countryModule.getAddress());

      expect(await compliance.isModuleBound(await countryModule.getAddress())).to.be.false;
    });

    it("Should return all modules", async function () {
      await compliance.addModule(await countryModule.getAddress());
      await compliance.addModule(await maxBalanceModule.getAddress());

      const modules = await compliance.getModules();
      expect(modules.length).to.equal(2);
      expect(modules).to.include(await countryModule.getAddress());
      expect(modules).to.include(await maxBalanceModule.getAddress());
    });

    it("Should fail to add duplicate module", async function () {
      await compliance.addModule(await countryModule.getAddress());

      await expect(compliance.addModule(await countryModule.getAddress())).to.be.revertedWith(
        "ModularCompliance: module already bound"
      );
    });

    it("Should fail to add module if not owner", async function () {
      await expect(compliance.connect(agent).addModule(await countryModule.getAddress()))
        .to.be.revertedWithCustomError(compliance, "OwnableUnauthorizedAccount")
        .withArgs(agent.address);
    });
  });

  describe("Token Binding", function () {
    it("Should fail to bind second token", async function () {
      const token2 = await hre.ethers.deployContract("Token", [
        "Token2",
        "TK2",
        await identityRegistry.getAddress(),
        await compliance.getAddress(),
      ]);

      await expect(compliance.bindToken(await token2.getAddress())).to.be.revertedWith(
        "ModularCompliance: token already bound"
      );
    });

    it("Should unbind token", async function () {
      await expect(compliance.unbindToken(await token.getAddress()))
        .to.emit(compliance, "TokenUnbound")
        .withArgs(await token.getAddress());

      expect(await compliance.getTokenBound()).to.equal(hre.ethers.ZeroAddress);
    });
  });

  describe("Compliance Checks", function () {
    it("Should allow transfer without modules", async function () {
      const canTransfer = await compliance.canTransfer(investor1.address, investor2.address, 100);
      expect(canTransfer).to.be.true;
    });

    it("Should allow transfer when modules pass", async function () {
      await compliance.addModule(await countryModule.getAddress());

      const canTransfer = await compliance.canTransfer(investor1.address, investor2.address, 100);
      expect(canTransfer).to.be.true;
    });
  });
});

describe("CountryRestrictModule", function () {
  let compliance;
  let token;
  let identityRegistry;
  let countryModule;
  let owner;
  let agent;
  let investor1;
  let investor2;
  let restrictedInvestor;

  const COUNTRY_US = 840;
  const COUNTRY_UK = 826;
  const COUNTRY_RESTRICTED = 999;

  beforeEach(async function () {
    [owner, agent, investor1, investor2, restrictedInvestor] = await hre.ethers.getSigners();

    identityRegistry = await hre.ethers.deployContract("IdentityRegistry");
    compliance = await hre.ethers.deployContract("ModularCompliance");
    token = await hre.ethers.deployContract("Token", [
      "SecurityToken",
      "SEC",
      await identityRegistry.getAddress(),
      await compliance.getAddress(),
    ]);

    await compliance.bindToken(await token.getAddress());

    countryModule = await hre.ethers.deployContract("CountryRestrictModule");
    await compliance.addModule(await countryModule.getAddress());

    await token.addAgent(agent.address);
    await identityRegistry.addAgent(agent.address);

    await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, COUNTRY_US);
    await identityRegistry.connect(agent).registerIdentity(investor2.address, investor2.address, COUNTRY_UK);
    await identityRegistry
      .connect(agent)
      .registerIdentity(restrictedInvestor.address, restrictedInvestor.address, COUNTRY_RESTRICTED);
  });

  it("Should restrict a country", async function () {
    await countryModule.addCountryRestriction(await compliance.getAddress(), COUNTRY_RESTRICTED);

    expect(await countryModule.isCountryRestricted(await compliance.getAddress(), COUNTRY_RESTRICTED)).to.be.true;
  });

  it("Should block transfer to restricted country", async function () {
    await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    await countryModule.addCountryRestriction(await compliance.getAddress(), COUNTRY_RESTRICTED);

    await expect(
      token.connect(investor1).transfer(restrictedInvestor.address, hre.ethers.parseEther("100"))
    ).to.be.revertedWith("Token: transfer not compliant");
  });

  it("Should allow transfer to unrestricted country", async function () {
    await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    await countryModule.addCountryRestriction(await compliance.getAddress(), COUNTRY_RESTRICTED);

    await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("100"));
    expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("100"));
  });
});

describe("MaxBalanceModule", function () {
  let compliance;
  let token;
  let identityRegistry;
  let maxBalanceModule;
  let owner;
  let agent;
  let investor1;
  let investor2;

  const COUNTRY_US = 840;
  const MAX_BALANCE = hre.ethers.parseEther("500");

  beforeEach(async function () {
    [owner, agent, investor1, investor2] = await hre.ethers.getSigners();

    identityRegistry = await hre.ethers.deployContract("IdentityRegistry");
    compliance = await hre.ethers.deployContract("ModularCompliance");
    token = await hre.ethers.deployContract("Token", [
      "SecurityToken",
      "SEC",
      await identityRegistry.getAddress(),
      await compliance.getAddress(),
    ]);

    await compliance.bindToken(await token.getAddress());

    maxBalanceModule = await hre.ethers.deployContract("MaxBalanceModule");
    await compliance.addModule(await maxBalanceModule.getAddress());

    await token.addAgent(agent.address);
    await identityRegistry.addAgent(agent.address);

    await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, COUNTRY_US);
    await identityRegistry.connect(agent).registerIdentity(investor2.address, investor2.address, COUNTRY_US);
  });

  it("Should set max balance", async function () {
    await maxBalanceModule.setMaxBalance(await compliance.getAddress(), MAX_BALANCE);

    expect(await maxBalanceModule.getMaxBalance(await compliance.getAddress())).to.equal(MAX_BALANCE);
  });

  it("Should block transfer exceeding max balance", async function () {
    await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    await maxBalanceModule.setMaxBalance(await compliance.getAddress(), MAX_BALANCE);

    await expect(
      token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("600"))
    ).to.be.revertedWith("Token: transfer not compliant");
  });

  it("Should allow transfer within max balance", async function () {
    await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    await maxBalanceModule.setMaxBalance(await compliance.getAddress(), MAX_BALANCE);

    await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("400"));
    expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("400"));
  });

  it("Should allow transfer when no max balance is set", async function () {
    await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));

    await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("900"));
    expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("900"));
  });
});
