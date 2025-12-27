const { expect } = require("chai");
const hre = require("hardhat");

describe("Token", function () {
  let token;
  let identityRegistry;
  let compliance;
  let owner;
  let agent;
  let investor1;
  let investor2;
  let unregistered;

  const NAME = "SecurityToken";
  const SYMBOL = "SEC";
  const COUNTRY_US = 840;
  const COUNTRY_UK = 826;

  beforeEach(async function () {
    [owner, agent, investor1, investor2, unregistered] = await hre.ethers.getSigners();

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

    // Add agent
    await token.addAgent(agent.address);
    await identityRegistry.addAgent(agent.address);

    // Register investors (using mock identity addresses for simplicity)
    const identity1 = investor1.address; // In production, use ONCHAINID
    const identity2 = investor2.address;

    await identityRegistry.connect(agent).registerIdentity(investor1.address, identity1, COUNTRY_US);
    await identityRegistry.connect(agent).registerIdentity(investor2.address, identity2, COUNTRY_UK);
  });

  describe("Deployment", function () {
    it("Should set the correct name", async function () {
      expect(await token.name()).to.equal(NAME);
    });

    it("Should set the correct symbol", async function () {
      expect(await token.symbol()).to.equal(SYMBOL);
    });

    it("Should set the correct decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should set the identity registry", async function () {
      expect(await token.identityRegistry()).to.equal(await identityRegistry.getAddress());
    });

    it("Should set the compliance contract", async function () {
      expect(await token.compliance()).to.equal(await compliance.getAddress());
    });

    it("Should set the owner correctly", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should allow agent to mint tokens to verified investor", async function () {
      const amount = hre.ethers.parseEther("1000");

      await expect(token.connect(agent).mint(investor1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(hre.ethers.ZeroAddress, investor1.address, amount);

      expect(await token.balanceOf(investor1.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("Should fail to mint to unregistered address", async function () {
      const amount = hre.ethers.parseEther("1000");

      await expect(token.connect(agent).mint(unregistered.address, amount)).to.be.revertedWith(
        "Token: recipient not verified"
      );
    });

    it("Should fail to mint if not agent", async function () {
      const amount = hre.ethers.parseEther("1000");

      await expect(token.connect(investor1).mint(investor1.address, amount)).to.be.revertedWith(
        "Token: caller is not an agent"
      );
    });

    it("Should fail to mint to zero address", async function () {
      const amount = hre.ethers.parseEther("1000");

      await expect(token.connect(agent).mint(hre.ethers.ZeroAddress, amount)).to.be.revertedWith(
        "Token: mint to zero address"
      );
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      // Mint tokens to investor1
      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    });

    it("Should transfer tokens between verified investors", async function () {
      const amount = hre.ethers.parseEther("100");

      await expect(token.connect(investor1).transfer(investor2.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(investor1.address, investor2.address, amount);

      expect(await token.balanceOf(investor2.address)).to.equal(amount);
    });

    it("Should fail to transfer to unverified address", async function () {
      const amount = hre.ethers.parseEther("100");

      await expect(token.connect(investor1).transfer(unregistered.address, amount)).to.be.revertedWith(
        "Token: recipient not verified"
      );
    });

    it("Should fail to transfer more than balance", async function () {
      const amount = hre.ethers.parseEther("2000");

      await expect(token.connect(investor1).transfer(investor2.address, amount)).to.be.revertedWith(
        "Token: transfer amount exceeds balance"
      );
    });

    it("Should fail to transfer when frozen", async function () {
      await token.connect(agent).setAddressFrozen(investor1.address, true);
      const amount = hre.ethers.parseEther("100");

      await expect(token.connect(investor1).transfer(investor2.address, amount)).to.be.revertedWith(
        "Token: address is frozen"
      );
    });

    it("Should fail to transfer when paused", async function () {
      await token.connect(agent).pause();
      const amount = hre.ethers.parseEther("100");

      await expect(token.connect(investor1).transfer(investor2.address, amount)).to.be.revertedWith(
        "Token: token is paused"
      );
    });
  });

  describe("Allowances", function () {
    beforeEach(async function () {
      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    });

    it("Should approve tokens for delegated transfer", async function () {
      const amount = hre.ethers.parseEther("100");

      await expect(token.connect(investor1).approve(investor2.address, amount))
        .to.emit(token, "Approval")
        .withArgs(investor1.address, investor2.address, amount);

      expect(await token.allowance(investor1.address, investor2.address)).to.equal(amount);
    });

    it("Should transferFrom with allowance", async function () {
      const amount = hre.ethers.parseEther("100");

      await token.connect(investor1).approve(investor2.address, amount);
      await token.connect(investor2).transferFrom(investor1.address, investor2.address, amount);

      expect(await token.balanceOf(investor2.address)).to.equal(amount);
      expect(await token.allowance(investor1.address, investor2.address)).to.equal(0);
    });

    it("Should fail transferFrom without sufficient allowance", async function () {
      const amount = hre.ethers.parseEther("100");

      await token.connect(investor1).approve(investor2.address, amount);

      await expect(
        token.connect(investor2).transferFrom(investor1.address, investor2.address, amount + 1n)
      ).to.be.revertedWith("Token: insufficient allowance");
    });
  });

  describe("Freezing", function () {
    beforeEach(async function () {
      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    });

    it("Should freeze an address", async function () {
      await expect(token.connect(agent).setAddressFrozen(investor1.address, true))
        .to.emit(token, "AddressFrozen")
        .withArgs(investor1.address, true, agent.address);

      expect(await token.isFrozen(investor1.address)).to.be.true;
    });

    it("Should unfreeze an address", async function () {
      await token.connect(agent).setAddressFrozen(investor1.address, true);
      await token.connect(agent).setAddressFrozen(investor1.address, false);

      expect(await token.isFrozen(investor1.address)).to.be.false;
    });

    it("Should freeze partial tokens", async function () {
      const amount = hre.ethers.parseEther("500");

      await expect(token.connect(agent).freezePartialTokens(investor1.address, amount))
        .to.emit(token, "TokensFrozen")
        .withArgs(investor1.address, amount);

      expect(await token.getFrozenTokens(investor1.address)).to.equal(amount);
    });

    it("Should prevent transfer of frozen tokens", async function () {
      const freezeAmount = hre.ethers.parseEther("800");
      const transferAmount = hre.ethers.parseEther("300");

      await token.connect(agent).freezePartialTokens(investor1.address, freezeAmount);

      await expect(token.connect(investor1).transfer(investor2.address, transferAmount)).to.be.revertedWith(
        "Token: insufficient unfrozen balance"
      );
    });

    it("Should allow transfer of unfrozen tokens", async function () {
      const freezeAmount = hre.ethers.parseEther("500");
      const transferAmount = hre.ethers.parseEther("400");

      await token.connect(agent).freezePartialTokens(investor1.address, freezeAmount);
      await token.connect(investor1).transfer(investor2.address, transferAmount);

      expect(await token.balanceOf(investor2.address)).to.equal(transferAmount);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
    });

    it("Should allow agent to burn tokens", async function () {
      const amount = hre.ethers.parseEther("500");
      const initialSupply = await token.totalSupply();

      await expect(token.connect(agent).burn(investor1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(investor1.address, hre.ethers.ZeroAddress, amount);

      expect(await token.totalSupply()).to.equal(initialSupply - amount);
    });

    it("Should fail to burn frozen tokens", async function () {
      await token.connect(agent).freezePartialTokens(investor1.address, hre.ethers.parseEther("800"));

      await expect(token.connect(agent).burn(investor1.address, hre.ethers.parseEther("500"))).to.be.revertedWith(
        "Token: frozen tokens cannot be burned"
      );
    });
  });

  describe("Pause", function () {
    it("Should pause the token", async function () {
      await expect(token.connect(agent).pause()).to.emit(token, "Paused").withArgs(agent.address);

      expect(await token.paused()).to.be.true;
    });

    it("Should unpause the token", async function () {
      await token.connect(agent).pause();
      await expect(token.connect(agent).unpause()).to.emit(token, "Unpaused").withArgs(agent.address);

      expect(await token.paused()).to.be.false;
    });
  });

  describe("Batch Transfer", function () {
    beforeEach(async function () {
      await token.connect(agent).mint(investor1.address, hre.ethers.parseEther("1000"));
      // Register more investors for batch testing
      await identityRegistry.connect(agent).registerIdentity(owner.address, owner.address, COUNTRY_US);
    });

    it("Should batch transfer to multiple recipients", async function () {
      const amounts = [hre.ethers.parseEther("100"), hre.ethers.parseEther("200")];
      const recipients = [investor2.address, owner.address];

      await token.connect(investor1).batchTransfer(recipients, amounts);

      expect(await token.balanceOf(investor2.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(owner.address)).to.equal(amounts[1]);
    });

    it("Should fail batch transfer with mismatched arrays", async function () {
      const amounts = [hre.ethers.parseEther("100")];
      const recipients = [investor2.address, owner.address];

      await expect(token.connect(investor1).batchTransfer(recipients, amounts)).to.be.revertedWith(
        "Token: arrays length mismatch"
      );
    });
  });
});
