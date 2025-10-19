// scripts/deployMockUSDT.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Mock USDT...");

  // Get the contract factory
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  // Deploy Mock USDT with 6 decimals
  const mockUSDT = await MockERC20.deploy(
    "Tether USD",        // name
    "USDT",              // symbol
    6                    // decimals
  );

  await mockUSDT.waitForDeployment();

  const mockUSDTAddress = await mockUSDT.getAddress();
  
  console.log("Mock USDT deployed to:", mockUSDTAddress);
  console.log("Name:", await mockUSDT.name());
  console.log("Symbol:", await mockUSDT.symbol());
  console.log("Decimals:", await mockUSDT.decimals());

  // Mint some tokens to the deployer for testing
  const [deployer] = await ethers.getSigners();
  const mintAmount = ethers.parseUnits("1000000", 6); // 1,000,000 USDT
  
  await mockUSDT.mint(deployer.address, mintAmount);
  console.log(`Minted ${ethers.formatUnits(mintAmount, 6)} USDT to deployer:`, deployer.address);
  console.log("Deployer balance:", ethers.formatUnits(await mockUSDT.balanceOf(deployer.address), 6), "USDT");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contract: "MockUSDT",
    address: mockUSDTAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    constructorArgs: {
      name: "Tether USD",
      symbol: "USDT", 
      decimals: 6
    }
  };

  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return mockUSDTAddress;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });