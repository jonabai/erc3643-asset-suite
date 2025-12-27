const { expect } = require("chai");
const hre = require("hardhat");

describe("IdentityRegistry", function () {
  let identityRegistry;
  let owner;
  let agent;
  let investor1;
  let investor2;

  const COUNTRY_US = 840;
  const COUNTRY_UK = 826;

  beforeEach(async function () {
    [owner, agent, investor1, investor2] = await hre.ethers.getSigners();

    identityRegistry = await hre.ethers.deployContract("IdentityRegistry");
    await identityRegistry.waitForDeployment();

    await identityRegistry.addAgent(agent.address);
  });

  describe("Deployment", function () {
    it("Should set the owner correctly", async function () {
      expect(await identityRegistry.owner()).to.equal(owner.address);
    });
  });

  describe("Agent Management", function () {
    it("Should add an agent", async function () {
      await expect(identityRegistry.addAgent(investor1.address))
        .to.emit(identityRegistry, "AgentAdded")
        .withArgs(investor1.address);

      expect(await identityRegistry.isAgent(investor1.address)).to.be.true;
    });

    it("Should remove an agent", async function () {
      await expect(identityRegistry.removeAgent(agent.address))
        .to.emit(identityRegistry, "AgentRemoved")
        .withArgs(agent.address);

      expect(await identityRegistry.isAgent(agent.address)).to.be.false;
    });

    it("Should fail to add agent if not owner", async function () {
      await expect(identityRegistry.connect(agent).addAgent(investor1.address))
        .to.be.revertedWithCustomError(identityRegistry, "OwnableUnauthorizedAccount")
        .withArgs(agent.address);
    });

    it("Should fail to add zero address as agent", async function () {
      await expect(identityRegistry.addAgent(hre.ethers.ZeroAddress)).to.be.revertedWith(
        "IdentityRegistry: zero address"
      );
    });

    it("Should fail to add duplicate agent", async function () {
      await expect(identityRegistry.addAgent(agent.address)).to.be.revertedWith(
        "IdentityRegistry: already an agent"
      );
    });
  });

  describe("Identity Registration", function () {
    it("Should register an identity", async function () {
      const identity = investor1.address; // Mock identity

      await expect(identityRegistry.connect(agent).registerIdentity(investor1.address, identity, COUNTRY_US))
        .to.emit(identityRegistry, "IdentityRegistered")
        .withArgs(investor1.address, identity)
        .and.to.emit(identityRegistry, "CountryUpdated")
        .withArgs(investor1.address, COUNTRY_US);

      expect(await identityRegistry.contains(investor1.address)).to.be.true;
      expect(await identityRegistry.identity(investor1.address)).to.equal(identity);
      expect(await identityRegistry.investorCountry(investor1.address)).to.equal(COUNTRY_US);
    });

    it("Should fail to register zero address", async function () {
      await expect(
        identityRegistry.connect(agent).registerIdentity(hre.ethers.ZeroAddress, investor1.address, COUNTRY_US)
      ).to.be.revertedWith("IdentityRegistry: zero address");
    });

    it("Should fail to register with zero identity", async function () {
      await expect(
        identityRegistry.connect(agent).registerIdentity(investor1.address, hre.ethers.ZeroAddress, COUNTRY_US)
      ).to.be.revertedWith("IdentityRegistry: zero identity");
    });

    it("Should fail to register duplicate investor", async function () {
      await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, COUNTRY_US);

      await expect(
        identityRegistry.connect(agent).registerIdentity(investor1.address, investor2.address, COUNTRY_UK)
      ).to.be.revertedWith("IdentityRegistry: already registered");
    });

    it("Should fail to register if not agent", async function () {
      await expect(
        identityRegistry.connect(investor1).registerIdentity(investor1.address, investor1.address, COUNTRY_US)
      ).to.be.revertedWith("IdentityRegistry: caller is not an agent");
    });
  });

  describe("Identity Management", function () {
    beforeEach(async function () {
      await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, COUNTRY_US);
    });

    it("Should update identity", async function () {
      const newIdentity = investor2.address;

      await expect(identityRegistry.connect(agent).updateIdentity(investor1.address, newIdentity))
        .to.emit(identityRegistry, "IdentityUpdated")
        .withArgs(investor1.address, newIdentity);

      expect(await identityRegistry.identity(investor1.address)).to.equal(newIdentity);
    });

    it("Should update country", async function () {
      await expect(identityRegistry.connect(agent).updateCountry(investor1.address, COUNTRY_UK))
        .to.emit(identityRegistry, "CountryUpdated")
        .withArgs(investor1.address, COUNTRY_UK);

      expect(await identityRegistry.investorCountry(investor1.address)).to.equal(COUNTRY_UK);
    });

    it("Should delete identity", async function () {
      await expect(identityRegistry.connect(agent).deleteIdentity(investor1.address))
        .to.emit(identityRegistry, "IdentityRemoved")
        .withArgs(investor1.address, investor1.address);

      expect(await identityRegistry.contains(investor1.address)).to.be.false;
    });

    it("Should fail to delete non-existent identity", async function () {
      await expect(identityRegistry.connect(agent).deleteIdentity(investor2.address)).to.be.revertedWith(
        "IdentityRegistry: not registered"
      );
    });
  });

  describe("Verification", function () {
    it("Should return true for registered investor", async function () {
      await identityRegistry.connect(agent).registerIdentity(investor1.address, investor1.address, COUNTRY_US);

      expect(await identityRegistry.isVerified(investor1.address)).to.be.true;
    });

    it("Should return false for unregistered address", async function () {
      expect(await identityRegistry.isVerified(investor1.address)).to.be.false;
    });
  });
});
