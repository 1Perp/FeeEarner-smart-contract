const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Upgrading FeeEarner...");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Get the proxy address from environment variable
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  
  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  console.log("Proxy Address:", PROXY_ADDRESS);

  // Get current implementation address
  const currentImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current Implementation:", currentImplementation);

  // Deploy new implementation
  const FeeEarnerV2 = await ethers.getContractFactory("FeeEarner");
  console.log("Deploying new implementation...");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, FeeEarnerV2);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log("\n=== Upgrade Successful ===");
  console.log("Proxy Address:", PROXY_ADDRESS);
  console.log("Old Implementation:", currentImplementation);
  console.log("New Implementation:", newImplementation);

  // Verify state preservation
  console.log("\n=== Verifying State ===");
  console.log("Owner:", await upgraded.owner());
  console.log("Liquidity Manager:", await upgraded.getLiquidityManager());
  console.log("Allowed Tokens:", await upgraded.getAllowedTokens());

  console.log("\n=== Next Steps ===");
  console.log("1. Verify the new implementation on block explorer:");
  console.log("   npx hardhat verify --network <network> " + newImplementation);
  console.log("2. Test the upgraded contract functionality");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

