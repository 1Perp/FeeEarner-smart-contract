const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying FeeEarner...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Configuration - Update these addresses before deployment
  const OWNER_ADDRESS = process.env.OWNER_ADDRESS || deployer.address;
  const LIQUIDITY_MANAGER_ADDRESS = process.env.LIQUIDITY_MANAGER_ADDRESS || deployer.address;
  
  // Initial allowed tokens - Update with actual token addresses
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // Ethereum Mainnet USDT
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Ethereum Mainnet USDC
  
  const initialTokens = [USDT_ADDRESS, USDC_ADDRESS];

  console.log("Configuration:");
  console.log("- Owner:", OWNER_ADDRESS);
  console.log("- Liquidity Manager:", LIQUIDITY_MANAGER_ADDRESS);
  console.log("- Initial Tokens:", initialTokens);

  // Deploy FeeEarner
  const FeeEarner = await ethers.getContractFactory("FeeEarner");
  const feeEarner = await upgrades.deployProxy(
    FeeEarner,
    [OWNER_ADDRESS, LIQUIDITY_MANAGER_ADDRESS, initialTokens],
    { 
      initializer: "initialize",
      kind: "uups"
    }
  );

  await feeEarner.waitForDeployment();

  const proxyAddress = await feeEarner.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n=== Deployment Successful ===");
  console.log("Proxy Address:", proxyAddress);
  console.log("Implementation Address:", implementationAddress);

  // Verify configuration
  console.log("\n=== Verifying Configuration ===");
  console.log("Owner:", await feeEarner.owner());
  console.log("Liquidity Manager:", await feeEarner.getLiquidityManager());
  console.log("Allowed Tokens:", await feeEarner.getAllowedTokens());

  // Auto-verify contract if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n=== Verifying Contract on Block Explorer ===");
    
    try {
      // Wait a bit for the transaction to be mined
      console.log("Waiting for transaction to be mined...");
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Verify the implementation contract
      console.log("Verifying implementation contract...");
      await hre.run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [], // No constructor arguments for proxy pattern
      });
      
      console.log("✅ Implementation contract verified successfully!");
      
      // For UUPS proxy, we also need to verify the proxy contract
      console.log("Verifying proxy contract...");
      await hre.run("verify:verify", {
        address: proxyAddress,
        constructorArguments: [
          implementationAddress,
          "0x" // Empty initialization data
        ],
      });
      
      console.log("✅ Proxy contract verified successfully!");
      
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
      console.log("You can manually verify later using:");
      console.log(`npx hardhat verify --network ${hre.network.name} ${implementationAddress}`);
      console.log(`npx hardhat verify --network ${hre.network.name} ${proxyAddress} ${implementationAddress} 0x`);
    }
  } else {
    console.log("\n=== Skipping Verification (Local Network) ===");
    console.log("Contract verification is skipped for local networks.");
  }

  console.log("\n=== Next Steps ===");
  console.log("1. Save the proxy address:", proxyAddress);
  console.log("2. Save the implementation address:", implementationAddress);
  console.log("3. Test the contract functionality");
  
  // Save deployment info to file
  const deploymentInfo = {
    network: hre.network.name,
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    owner: OWNER_ADDRESS,
    liquidityManager: LIQUIDITY_MANAGER_ADDRESS,
    initialTokens: initialTokens,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    verified: hre.network.name !== "hardhat" && hre.network.name !== "localhost"
  };

  console.log("\n=== Deployment Info ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

