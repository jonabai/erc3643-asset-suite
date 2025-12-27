const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("TokenFactory", function () {
  async function deployFactoryFixture() {
    const [owner, admin, factoryUser, investor1, investor2] = await hre.ethers.getSigners();

    // Deploy implementations
    const Token = await hre.ethers.getContractFactory("TokenUpgradeable");
    const tokenImpl = await Token.deploy();

    const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistryUpgradeable");
    const registryImpl = await IdentityRegistry.deploy();

    const Compliance = await hre.ethers.getContractFactory("ModularComplianceUpgradeable");
    const complianceImpl = await Compliance.deploy();

    // Deploy factory
    const Factory = await hre.ethers.getContractFactory("TokenFactory");
    const factory = await hre.upgrades.deployProxy(
      Factory,
      [
        admin.address,
        await tokenImpl.getAddress(),
        await registryImpl.getAddress(),
        await complianceImpl.getAddress(),
      ],
      { kind: "uups" }
    );

    // Grant factory role
    const FACTORY_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("FACTORY_ROLE"));
    await factory.connect(admin).grantRole(FACTORY_ROLE, factoryUser.address);

    return {
      factory,
      tokenImpl,
      registryImpl,
      complianceImpl,
      owner,
      admin,
      factoryUser,
      investor1,
      investor2,
      FACTORY_ROLE,
    };
  }

  describe("Deployment", function () {
    it("Should initialize correctly", async function () {
      const { factory, tokenImpl, registryImpl, complianceImpl } = await loadFixture(deployFactoryFixture);

      expect(await factory.tokenImplementation()).to.equal(await tokenImpl.getAddress());
      expect(await factory.identityRegistryImplementation()).to.equal(await registryImpl.getAddress());
      expect(await factory.complianceImplementation()).to.equal(await complianceImpl.getAddress());
      expect(await factory.version()).to.equal("1.0.0");
    });

    it("Should have zero deployed tokens initially", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      expect(await factory.getDeployedTokenCount()).to.equal(0);
    });
  });

  describe("Token Suite Deployment", function () {
    it("Should deploy complete token suite", async function () {
      const { factory, factoryUser, admin } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Security Token",
        symbol: "TST",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      };

      const tx = await factory.connect(factoryUser).deployTokenSuite(params);
      const receipt = await tx.wait();

      // Check event
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "TokenSuiteDeployed"
      );
      expect(event).to.not.be.undefined;

      // Check deployed count
      expect(await factory.getDeployedTokenCount()).to.equal(1);

      // Get deployed tokens
      const deployedTokens = await factory.getDeployedTokens();
      expect(deployedTokens.length).to.equal(1);

      // Check token deployment info
      const deployment = await factory.getTokenDeployment(deployedTokens[0]);
      expect(deployment.name).to.equal("Test Security Token");
      expect(deployment.symbol).to.equal("TST");
      expect(deployment.deployer).to.equal(factoryUser.address);
      expect(deployment.exists).to.be.true;
    });

    it("Should deploy multiple token suites", async function () {
      const { factory, factoryUser, admin } = await loadFixture(deployFactoryFixture);

      // Deploy first token
      await factory.connect(factoryUser).deployTokenSuite({
        name: "Token One",
        symbol: "TK1",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      });

      // Deploy second token
      await factory.connect(factoryUser).deployTokenSuite({
        name: "Token Two",
        symbol: "TK2",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      });

      expect(await factory.getDeployedTokenCount()).to.equal(2);
    });

    it("Should fail without FACTORY_ROLE", async function () {
      const { factory, investor1, admin, FACTORY_ROLE } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "Test Token",
        symbol: "TST",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      };

      await expect(factory.connect(investor1).deployTokenSuite(params))
        .to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount")
        .withArgs(investor1.address, FACTORY_ROLE);
    });

    it("Should fail with empty name", async function () {
      const { factory, factoryUser, admin } = await loadFixture(deployFactoryFixture);

      const params = {
        name: "",
        symbol: "TST",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      };

      await expect(factory.connect(factoryUser).deployTokenSuite(params)).to.be.revertedWith(
        "TokenFactory: empty name"
      );
    });
  });

  describe("Token Only Deployment", function () {
    it("Should deploy token with existing registry and compliance", async function () {
      const { factory, factoryUser, admin } = await loadFixture(deployFactoryFixture);

      // First deploy a suite to get registry and compliance
      const params = {
        name: "First Token",
        symbol: "FT1",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      };

      await factory.connect(factoryUser).deployTokenSuite(params);
      const tokens = await factory.getDeployedTokens();
      const firstDeployment = await factory.getTokenDeployment(tokens[0]);

      // Deploy second token using existing infrastructure
      await factory
        .connect(factoryUser)
        .deployTokenOnly(
          "Second Token",
          "ST2",
          firstDeployment.identityRegistry,
          firstDeployment.compliance,
          admin.address
        );

      expect(await factory.getDeployedTokenCount()).to.equal(2);

      // Verify second token uses same registry
      const secondDeployment = await factory.getTokenDeployment((await factory.getDeployedTokens())[1]);
      expect(secondDeployment.identityRegistry).to.equal(firstDeployment.identityRegistry);
    });
  });

  describe("Factory Management", function () {
    it("Should update implementations", async function () {
      const { factory, admin } = await loadFixture(deployFactoryFixture);

      // Deploy new implementations
      const NewToken = await hre.ethers.getContractFactory("TokenUpgradeable");
      const newTokenImpl = await NewToken.deploy();

      const NewRegistry = await hre.ethers.getContractFactory("IdentityRegistryUpgradeable");
      const newRegistryImpl = await NewRegistry.deploy();

      const NewCompliance = await hre.ethers.getContractFactory("ModularComplianceUpgradeable");
      const newComplianceImpl = await NewCompliance.deploy();

      await expect(
        factory
          .connect(admin)
          .setImplementations(
            await newTokenImpl.getAddress(),
            await newRegistryImpl.getAddress(),
            await newComplianceImpl.getAddress()
          )
      ).to.emit(factory, "ImplementationsSet");

      expect(await factory.tokenImplementation()).to.equal(await newTokenImpl.getAddress());
    });

    it("Should check if token is factory deployed", async function () {
      const { factory, factoryUser, admin, investor1 } = await loadFixture(deployFactoryFixture);

      // Deploy a token
      await factory.connect(factoryUser).deployTokenSuite({
        name: "Test Token",
        symbol: "TST",
        tokenAdmin: admin.address,
        registryAdmin: admin.address,
        complianceAdmin: admin.address,
      });

      const tokens = await factory.getDeployedTokens();
      expect(await factory.isFactoryDeployed(tokens[0])).to.be.true;
      expect(await factory.isFactoryDeployed(investor1.address)).to.be.false;
    });
  });
});
