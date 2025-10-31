const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("FeeEarner", function () {
  async function deployFeeEarnerFixture() {
    const [owner, liquidityManager, user1, user2, newManager] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);

    // Deploy FeeEarner as upgradeable
    const FeeEarner = await ethers.getContractFactory("FeeEarner");
    const feeEarner = await upgrades.deployProxy(
      FeeEarner,
      [owner.address, liquidityManager.address, [usdt.target, usdc.target]],
      { initializer: "initialize" }
    );

    // Mint tokens to users
    await usdt.mint(user1.address, ethers.parseUnits("10000", 6));
    await usdc.mint(user1.address, ethers.parseUnits("10000", 6));
    await dai.mint(user1.address, ethers.parseUnits("10000", 18));

    await usdt.mint(user2.address, ethers.parseUnits("5000", 6));
    await usdc.mint(user2.address, ethers.parseUnits("5000", 6));

    return { feeEarner, usdt, usdc, dai, owner, liquidityManager, user1, user2, newManager };
  }

  // Setup: deploy proxy with two allowed tokens (USDT, USDC)
  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { feeEarner, owner } = await loadFixture(deployFeeEarnerFixture);
      expect(await feeEarner.owner()).to.equal(owner.address);
    });

    it("Should set the correct liquidity manager", async function () {
      const { feeEarner, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      expect(await feeEarner.getLiquidityManager()).to.equal(liquidityManager.address);
    });

    it("Should initialize with correct allowed tokens", async function () {
      const { feeEarner, usdt, usdc } = await loadFixture(deployFeeEarnerFixture);
      const allowedTokens = await feeEarner.getAllowedTokens();
      expect(allowedTokens.length).to.equal(2);
      expect(allowedTokens[0]).to.equal(usdt.target);
      expect(allowedTokens[1]).to.equal(usdc.target);
    });

    it("Should revert if initialized with zero address owner", async function () {
      const { liquidityManager, usdt, usdc } = await loadFixture(deployFeeEarnerFixture);
      const FeeEarner = await ethers.getContractFactory("FeeEarner");
      
      await expect(
        upgrades.deployProxy(
          FeeEarner,
          [ethers.ZeroAddress, liquidityManager.address, [usdt.target, usdc.target]],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(FeeEarner, "ZeroAddress");
    });

    it("Should revert if initialized with zero address liquidity manager", async function () {
      const { owner, usdt, usdc } = await loadFixture(deployFeeEarnerFixture);
      const FeeEarner = await ethers.getContractFactory("FeeEarner");
      
      await expect(
        upgrades.deployProxy(
          FeeEarner,
          [owner.address, ethers.ZeroAddress, [usdt.target, usdc.target]],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(FeeEarner, "ZeroAddress");
    });

    it("Should revert if initialTokens contain duplicates", async function () {
      const [owner, liquidityManager] = await ethers.getSigners();
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const t = await MockERC20.deploy("Tether USD", "USDT", 6);
      const FeeEarner = await ethers.getContractFactory("FeeEarner");

      await expect(
        upgrades.deployProxy(
          FeeEarner,
          [owner.address, liquidityManager.address, [t.target, t.target]],
          { initializer: "initialize" }
        )
      ).to.be.revertedWithCustomError(FeeEarner, "TokenAlreadyAdded");
    });
  });

  // Approve and contribute
  describe("Contribution", function () {
    it("Should allow users to contribute allowed tokens", async function () {
      const { feeEarner, usdt, user1 } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await expect(feeEarner.connect(user1).contribute(usdt.target, amount))
        .to.emit(feeEarner, "Contribution")
        .withArgs(user1.address, usdt.target, amount);

      expect(await feeEarner.getUserContribution(user1.address, usdt.target)).to.equal(amount);
      expect(await feeEarner.getTotalContribution(usdt.target)).to.equal(amount);
      expect(await usdt.balanceOf(feeEarner.target)).to.equal(amount);
    });

    it("Should accumulate multiple contributions", async function () {
      const { feeEarner, usdt, user1 } = await loadFixture(deployFeeEarnerFixture);
      const amount1 = ethers.parseUnits("100", 6);
      const amount2 = ethers.parseUnits("200", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount1 + amount2);
      await feeEarner.connect(user1).contribute(usdt.target, amount1);
      await feeEarner.connect(user1).contribute(usdt.target, amount2);

      expect(await feeEarner.getUserContribution(user1.address, usdt.target)).to.equal(amount1 + amount2);
      expect(await feeEarner.getTotalContribution(usdt.target)).to.equal(amount1 + amount2);
    });

    it("Should track contributions from multiple users", async function () {
      const { feeEarner, usdt, user1, user2 } = await loadFixture(deployFeeEarnerFixture);
      const amount1 = ethers.parseUnits("100", 6);
      const amount2 = ethers.parseUnits("200", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount1);
      await usdt.connect(user2).approve(feeEarner.target, amount2);

      await feeEarner.connect(user1).contribute(usdt.target, amount1);
      await feeEarner.connect(user2).contribute(usdt.target, amount2);

      expect(await feeEarner.getUserContribution(user1.address, usdt.target)).to.equal(amount1);
      expect(await feeEarner.getUserContribution(user2.address, usdt.target)).to.equal(amount2);
      expect(await feeEarner.getTotalContribution(usdt.target)).to.equal(amount1 + amount2);
    });

    it("Should revert if token is not allowed", async function () {
      const { feeEarner, dai, user1 } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 18);

      await dai.connect(user1).approve(feeEarner.target, amount);
      await expect(
        feeEarner.connect(user1).contribute(dai.target, amount)
      ).to.be.revertedWithCustomError(feeEarner, "TokenNotAllowed");
    });

    it("Should revert if amount is zero", async function () {
      const { feeEarner, usdt, user1 } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(user1).contribute(usdt.target, 0)
      ).to.be.revertedWithCustomError(feeEarner, "ZeroAmount");
    });

    it("Should revert if token address is zero", async function () {
      const { feeEarner, user1 } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(user1).contribute(ethers.ZeroAddress, 100)
      ).to.be.revertedWithCustomError(feeEarner, "ZeroAddress");
    });

    it("Should revert when paused", async function () {
      const { feeEarner, usdt, user1, owner } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await feeEarner.connect(owner).pause();
      await usdt.connect(user1).approve(feeEarner.target, amount);

      await expect(
        feeEarner.connect(user1).contribute(usdt.target, amount)
      ).to.be.revertedWithCustomError(feeEarner, "EnforcedPause");
    });
  });

  // Token management tests
  describe("Token Management", function () {
    it("Should allow owner to add new token", async function () {
      const { feeEarner, dai, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(feeEarner.connect(owner).addAllowedToken(dai.target))
        .to.emit(feeEarner, "TokenAdded")
        .withArgs(dai.target);

      expect(await feeEarner.isAllowedToken(dai.target)).to.be.true;
      const allowedTokens = await feeEarner.getAllowedTokens();
      expect(allowedTokens.length).to.equal(3);
    });

    it("Should revert if non-owner tries to add token", async function () {
      const { feeEarner, dai, user1 } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(user1).addAllowedToken(dai.target)
      ).to.be.revertedWithCustomError(feeEarner, "OwnableUnauthorizedAccount");
    });

    it("Should revert if adding duplicate token", async function () {
      const { feeEarner, usdt, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(owner).addAllowedToken(usdt.target)
      ).to.be.revertedWithCustomError(feeEarner, "TokenAlreadyAdded");
    });

    it("Should revert if adding zero address token", async function () {
      const { feeEarner, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(owner).addAllowedToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(feeEarner, "ZeroAddress");
    });

    it("Should allow owner to remove token with zero balance", async function () {
      const { feeEarner, usdt, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(feeEarner.connect(owner).removeAllowedToken(usdt.target))
        .to.emit(feeEarner, "TokenRemoved")
        .withArgs(usdt.target);

      expect(await feeEarner.isAllowedToken(usdt.target)).to.be.false;
      const allowedTokens = await feeEarner.getAllowedTokens();
      expect(allowedTokens.length).to.equal(1);
    });

    it("Should allow removing token even when it has non-zero balance", async function () {
      const { feeEarner, usdt, user1, owner, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      const lmBalBefore = await usdt.balanceOf(liquidityManager.address);

      await expect(feeEarner.connect(owner).removeAllowedToken(usdt.target))
        .to.emit(feeEarner, "TokenRemoved")
        .withArgs(usdt.target);

      // Token is no longer allowed
      expect(await feeEarner.isAllowedToken(usdt.target)).to.be.false;

      // Balance remains in contract after removal
      expect(await usdt.balanceOf(feeEarner.target)).to.equal(amount);

      // withdrawAll no longer sweeps removed token
      await expect(feeEarner.connect(liquidityManager).withdrawAll()).to.not.be.reverted;
      expect(await usdt.balanceOf(liquidityManager.address)).to.equal(lmBalBefore);
      expect(await usdt.balanceOf(feeEarner.target)).to.equal(amount);
    });

    it("Should revert if removing non-existent token", async function () {
      const { feeEarner, dai, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(owner).removeAllowedToken(dai.target)
      ).to.be.revertedWithCustomError(feeEarner, "TokenNotFound");
    });
  });

  // Liquidity manager permissions
  describe("Liquidity Manager Management", function () {
    it("Should allow owner to set new liquidity manager", async function () {
      const { feeEarner, liquidityManager, newManager, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(feeEarner.connect(owner).setLiquidityManager(newManager.address))
        .to.emit(feeEarner, "LiquidityManagerUpdated")
        .withArgs(liquidityManager.address, newManager.address);

      expect(await feeEarner.getLiquidityManager()).to.equal(newManager.address);
    });

    it("Should revert if non-owner tries to set liquidity manager", async function () {
      const { feeEarner, newManager, user1 } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(user1).setLiquidityManager(newManager.address)
      ).to.be.revertedWithCustomError(feeEarner, "OwnableUnauthorizedAccount");
    });

    it("Should revert if setting zero address as liquidity manager", async function () {
      const { feeEarner, owner } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(owner).setLiquidityManager(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(feeEarner, "ZeroAddress");
    });

    it("Should revert if setting the same liquidity manager", async function () {
      const { feeEarner, owner, liquidityManager } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(owner).setLiquidityManager(liquidityManager.address)
      ).to.be.revertedWithCustomError(feeEarner, "LiquidityManagerUnchanged");
    });
  });

  // Withdrawals
  describe("Withdrawal", function () {
    it("Should allow liquidity manager to withdraw tokens", async function () {
      const { feeEarner, usdt, user1, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      const initialBalance = await usdt.balanceOf(liquidityManager.address);

      await expect(feeEarner.connect(liquidityManager).withdraw(usdt.target, amount))
        .to.emit(feeEarner, "Withdrawal")
        .withArgs(usdt.target, amount, liquidityManager.address);

      expect(await usdt.balanceOf(liquidityManager.address)).to.equal(initialBalance + amount);
      expect(await usdt.balanceOf(feeEarner.target)).to.equal(0);
    });

    it("Should revert if non-liquidity manager tries to withdraw", async function () {
      const { feeEarner, usdt, user1 } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      await expect(
        feeEarner.connect(user1).withdraw(usdt.target, amount)
      ).to.be.revertedWithCustomError(feeEarner, "NotLiquidityManager");
    });

    it("Should revert if withdrawing more than balance", async function () {
      const { feeEarner, usdt, user1, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      await expect(
        feeEarner.connect(liquidityManager).withdraw(usdt.target, amount + 1n)
      ).to.be.revertedWithCustomError(feeEarner, "InsufficientBalance");
    });

    it("Should revert if withdrawing zero amount", async function () {
      const { feeEarner, usdt, liquidityManager } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(liquidityManager).withdraw(usdt.target, 0)
      ).to.be.revertedWithCustomError(feeEarner, "ZeroAmount");
    });

    it("Should allow liquidity manager to withdraw all tokens", async function () {
      const { feeEarner, usdt, usdc, user1, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      const usdtAmount = ethers.parseUnits("100", 6);
      const usdcAmount = ethers.parseUnits("200", 6);

      await usdt.connect(user1).approve(feeEarner.target, usdtAmount);
      await usdc.connect(user1).approve(feeEarner.target, usdcAmount);
      await feeEarner.connect(user1).contribute(usdt.target, usdtAmount);
      await feeEarner.connect(user1).contribute(usdc.target, usdcAmount);

      const initialUsdtBalance = await usdt.balanceOf(liquidityManager.address);
      const initialUsdcBalance = await usdc.balanceOf(liquidityManager.address);

      await feeEarner.connect(liquidityManager).withdrawAll();

      expect(await usdt.balanceOf(liquidityManager.address)).to.equal(initialUsdtBalance + usdtAmount);
      expect(await usdc.balanceOf(liquidityManager.address)).to.equal(initialUsdcBalance + usdcAmount);
      expect(await usdt.balanceOf(feeEarner.target)).to.equal(0);
      expect(await usdc.balanceOf(feeEarner.target)).to.equal(0);
    });

    it("Should not revert withdrawAll if some tokens have zero balance", async function () {
      const { feeEarner, usdt, user1, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      await expect(feeEarner.connect(liquidityManager).withdrawAll()).to.not.be.reverted;
    });

    it("Should revert withdraw when paused", async function () {
      const { feeEarner, usdt, user1, liquidityManager, owner } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("50", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      await feeEarner.connect(owner).pause();

      await expect(
        feeEarner.connect(liquidityManager).withdraw(usdt.target, amount)
      ).to.be.revertedWithCustomError(feeEarner, "EnforcedPause");
    });

    it("Should revert withdrawAll when paused", async function () {
      const { feeEarner, usdt, user1, liquidityManager, owner } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("10", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      await feeEarner.connect(owner).pause();

      await expect(
        feeEarner.connect(liquidityManager).withdrawAll()
      ).to.be.revertedWithCustomError(feeEarner, "EnforcedPause");
    });
  });

  // Pause / Unpause
  describe("Pause/Unpause", function () {
    it("Should allow owner to pause", async function () {
      const { feeEarner, owner } = await loadFixture(deployFeeEarnerFixture);

      await feeEarner.connect(owner).pause();
      expect(await feeEarner.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      const { feeEarner, owner } = await loadFixture(deployFeeEarnerFixture);

      await feeEarner.connect(owner).pause();
      await feeEarner.connect(owner).unpause();
      expect(await feeEarner.paused()).to.be.false;
    });

    it("Should revert if non-owner tries to pause", async function () {
      const { feeEarner, user1 } = await loadFixture(deployFeeEarnerFixture);

      await expect(
        feeEarner.connect(user1).pause()
      ).to.be.revertedWithCustomError(feeEarner, "OwnableUnauthorizedAccount");
    });
  });

  // Ownership (Ownable2Step)
  describe("Ownership Transfer", function () {
    it("Should support 2-step ownership transfer", async function () {
      const { feeEarner, owner, user1 } = await loadFixture(deployFeeEarnerFixture);

      await feeEarner.connect(owner).transferOwnership(user1.address);
      expect(await feeEarner.owner()).to.equal(owner.address);
      expect(await feeEarner.pendingOwner()).to.equal(user1.address);

      await feeEarner.connect(user1).acceptOwnership();
      expect(await feeEarner.owner()).to.equal(user1.address);
    });
  });

  // Upgradeability (UUPS)
  describe("Upgradeability", function () {
    it("Should be upgradeable by owner", async function () {
      const { feeEarner, owner } = await loadFixture(deployFeeEarnerFixture);

      const FeeEarnerV2 = await ethers.getContractFactory("FeeEarner", owner);
      const upgraded = await upgrades.upgradeProxy(feeEarner.target, FeeEarnerV2);

      expect(await upgraded.owner()).to.equal(owner.address);
    });

    it("Should preserve state after upgrade", async function () {
      const { feeEarner, usdt, user1, owner, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      const amount = ethers.parseUnits("100", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount);
      await feeEarner.connect(user1).contribute(usdt.target, amount);

      const FeeEarnerV2 = await ethers.getContractFactory("FeeEarner", owner);
      const upgraded = await upgrades.upgradeProxy(feeEarner.target, FeeEarnerV2);

      expect(await upgraded.getUserContribution(user1.address, usdt.target)).to.equal(amount);
      expect(await upgraded.getTotalContribution(usdt.target)).to.equal(amount);
      expect(await upgraded.getLiquidityManager()).to.equal(liquidityManager.address);
    });
  });

  // Read helpers
  describe("getTokenBalance", function () {
    it("getTokenBalance should return contract ERC20 balance", async () => {
      const { feeEarner, usdt, user1 } = await loadFixture(deployFeeEarnerFixture);
      const amt = ethers.parseUnits("123", 6);
      await usdt.connect(user1).approve(feeEarner.target, amt);
      await feeEarner.connect(user1).contribute(usdt.target, amt);
      expect(await feeEarner.getTokenBalance(usdt.target)).to.equal(amt);
    });
  });

  describe("version", function () {
    it("version should return current version", async () => {
      const { feeEarner } = await loadFixture(deployFeeEarnerFixture);
      expect(await feeEarner.version()).to.equal("1.0.0");
    });
  });

  // Edge case: initialTokens exceed MAX_TOKENS (should revert)
  describe("Initialization edge cases", function () {
    it("Should revert when initialTokens exceed MAX_TOKENS", async function () {
      const [owner, liquidityManager] = await ethers.getSigners();
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      // MAX_TOKENS = 20, construct 21 tokens
      const tokens = [];
      for (let i = 0; i < 21; i++) {
        const t = await MockERC20.deploy(`T${i}`, `T${i}`, 6);
        tokens.push(t.target);
      }
      const FeeEarner = await ethers.getContractFactory("FeeEarner");
      await expect(
        upgrades.deployProxy(FeeEarner, [owner.address, liquidityManager.address, tokens], { initializer: "initialize" })
      ).to.be.revertedWithCustomError(FeeEarner, "MaxTokensReached");
    });
  });

  // Remove last element from allowlist
  describe("removeAllowedToken positions", function () {
    it("Should remove token when it's the last element", async function () {
      const { feeEarner } = await loadFixture(deployFeeEarnerFixture);

      // Initially [usdt, usdc], remove the last one (usdc)
      const allowed = await feeEarner.getAllowedTokens();
      const last = allowed[allowed.length - 1];
      await expect(feeEarner.removeAllowedToken(last))
        .to.emit(feeEarner, "TokenRemoved")
        .withArgs(last);

      const after = await feeEarner.getAllowedTokens();
      expect(after.includes(last)).to.equal(false);
      expect(after.length).to.equal(allowed.length - 1);
    });

    it("Should remove token when it's a middle element", async function () {
      const { feeEarner } = await loadFixture(deployFeeEarnerFixture);

      // Add a third token to build [usdt, usdc, dai]
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
      await feeEarner.addAllowedToken(dai.target);

      const before = await feeEarner.getAllowedTokens();
      // Remove the middle one (original index 1)
      const middle = before[1];
      await expect(feeEarner.removeAllowedToken(middle))
        .to.emit(feeEarner, "TokenRemoved")
        .withArgs(middle);

      const after = await feeEarner.getAllowedTokens();
      expect(after.includes(middle)).to.equal(false);
      expect(after.length).to.equal(before.length - 1);
      // Validate compaction: the removed index should now hold the former last element
      expect(after[1]).to.equal(before[before.length - 1]);
    });

    it("Should remove the only element when list size is 1", async function () {
      const { feeEarner } = await loadFixture(deployFeeEarnerFixture);

      // First remove down to a single token, then test removing the only element
      let tokens = await feeEarner.getAllowedTokens();
      await feeEarner.removeAllowedToken(tokens[1]); // Remove the second token
      tokens = await feeEarner.getAllowedTokens();
      // Now only one remains; remove the sole element
      await expect(feeEarner.removeAllowedToken(tokens[0]))
        .to.emit(feeEarner, "TokenRemoved")
        .withArgs(tokens[0]);

      const after = await feeEarner.getAllowedTokens();
      expect(after.length).to.equal(0);
    });
  });

  // withdrawAll edge cases
  describe("withdrawAll edge cases", function () {
    it("Should not revert when allowedTokens is empty", async function () {
      const { feeEarner, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      // Clear the allowlist (requires owner privileges)
      const tokens = await feeEarner.getAllowedTokens();
      for (const t of tokens) {
        await feeEarner.removeAllowedToken(t);
      }
      // Must be called by liquidityManager
      await expect(feeEarner.connect(liquidityManager).withdrawAll()).to.not.be.reverted;
    });

    it("Should not transfer when all token balances are zero", async function () {
      const { feeEarner, liquidityManager } = await loadFixture(deployFeeEarnerFixture);
      // All allowed tokens have zero balance by default
      // Must be called by liquidityManager
      await expect(feeEarner.connect(liquidityManager).withdrawAll()).to.not.be.reverted;
    });
  });

  // Read contribution for arbitrary user
  describe("Read helpers", function () {
    it("getUserContribution can read arbitrary user's contribution", async function () {
      const { feeEarner, usdt, user1, user2 } = await loadFixture(deployFeeEarnerFixture);
      const amount1 = ethers.parseUnits("50", 6);
      const amount2 = ethers.parseUnits("70", 6);

      await usdt.connect(user1).approve(feeEarner.target, amount1);
      await usdt.connect(user2).approve(feeEarner.target, amount2);

      await feeEarner.connect(user1).contribute(usdt.target, amount1);
      await feeEarner.connect(user2).contribute(usdt.target, amount2);

      expect(await feeEarner.getUserContribution(user1.address, usdt.target)).to.equal(amount1);
      expect(await feeEarner.getUserContribution(user2.address, usdt.target)).to.equal(amount2);
    });
  });
});

