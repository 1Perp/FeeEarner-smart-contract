# FeeEarner - Upgradeable Sponsorship Contract

FeeEarner is a secure, upgradeable EVM smart contract that allows users to contribute ERC20 tokens (such as USDC/USDT) to a sponsorship pool. The contract implements role-based access control with three distinct roles: Users, Owner, and Liquidity Manager.

## Features

- **User Contributions**: Users can contribute allowed ERC20 tokens to the contract
- **Contribution Tracking**: Individual and total contributions are tracked on-chain
- **Token Whitelist**: Owner-managed list of allowed ERC20 tokens
- **Liquidity Management**: Dedicated role for withdrawing funds
- **Upgradeable**: Implements UUPS proxy pattern for future upgrades
- **Security**: Includes pausable functionality, reentrancy protection, and 2-step ownership transfer
- **Gas Optimized**: Efficient storage layout and operations

## Architecture

### Roles

1. **Users**: Can contribute allowed ERC20 tokens
2. **Owner**: Manages token whitelist, liquidity manager, and contract upgrades
3. **Liquidity Manager**: Can withdraw tokens from the contract

### Inheritance

```
FeeEarner
  ├── Initializable
  ├── UUPSUpgradeable
  ├── Ownable2StepUpgradeable
  ├── PausableUpgradeable
  └── ReentrancyGuardUpgradeable
```

## Installation

```bash
# Install dependencies (recommend Node.js v18 or v20)
# Using npm
npm install
# Or using pnpm
pnpm install

# Create environment file
touch .env
# Edit .env with your configuration
nano .env
```

## Configuration

Edit `.env` file with your configuration:

```env
PRIVATE_KEY=your_private_key_here
OWNER_ADDRESS=0x...
LIQUIDITY_MANAGER_ADDRESS=0x...
USDT_ADDRESS=0x...
USDC_ADDRESS=0x...
SEPOLIA_RPC_URL=https://...
MAINNET_RPC_URL=https://...
ETHERSCAN_API_KEY=your_api_key
```

## Usage

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Run Tests with Coverage

```bash
npx hardhat coverage
```

### Run Tests with Gas Report

```bash
REPORT_GAS=true npx hardhat test
```

### Deploy Contract

```bash
# Deploy to local network
npx hardhat run scripts/deploy.js

# Deploy to testnet
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network mainnet
```

### Upgrade Contract

```bash
# Set proxy address in .env
PROXY_ADDRESS=0x...

# Run upgrade script
npx hardhat run scripts/upgrade.js --network <network>
```


## Contract Functions

### User Functions

- `contribute(address token, uint256 amount)`: Contribute ERC20 tokens
- `getUserContribution(address user, address token)`: View user's contribution
- `getTotalContribution(address token)`: View total contributions for a token
  
Note: Before calling `contribute`, the user must `approve` the contract to spend the token.

### Owner Functions

- `addAllowedToken(address token)`: Add token to whitelist
- `removeAllowedToken(address token)`: Remove token from whitelist
- `setLiquidityManager(address newManager)`: Update liquidity manager
- `pause()`: Pause contract operations
- `unpause()`: Resume contract operations
- `transferOwnership(address newOwner)`: Initiate ownership transfer
- `acceptOwnership()`: Accept ownership transfer

### Liquidity Manager Functions

- `withdraw(address token, uint256 amount)`: Withdraw specific amount
- `withdrawAll()`: Withdraw all tokens

### View Functions

- `getAllowedTokens()`: Get list of allowed tokens
- `isAllowedToken(address token)`: Check if token is allowed
- `getLiquidityManager()`: Get liquidity manager address
- `owner()`: Get owner address
- `paused()`: Check if contract is paused
- `getTokenBalance(address token)`: Get the contract's ERC20 balance for a token
- `version()`: Get the current implementation version

## Events

```solidity
event Contribution(address indexed user, address indexed token, uint256 amount);
event TokenAdded(address indexed token);
event TokenRemoved(address indexed token);
event LiquidityManagerUpdated(address indexed oldManager, address indexed newManager);
event Withdrawal(address indexed token, uint256 amount, address indexed to);
```

## Security Features

1. **Reentrancy Protection**: All state-changing functions use `nonReentrant` modifier
2. **Pausable**: Emergency pause functionality for security incidents
3. **2-Step Ownership Transfer**: Prevents accidental ownership transfer
4. **Input Validation**: Comprehensive checks for zero addresses and amounts
5. **Token Whitelist**: Only approved tokens can be contributed
6. **Balance Checks**: Prevents removal of tokens with non-zero balance
7. **Upgradeable**: UUPS pattern allows security patches and improvements

## Token Addresses

### Ethereum Mainnet
- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

### Ethereum Sepolia
- USDT: Deploy MockERC20 or use existing testnet tokens
- USDC: Deploy MockERC20 or use existing testnet tokens
```
Note: Current Hardhat networks are configured for Ethereum mainnet and Sepolia.
```

## Development

### Project Structure

```
FeeEarner/
├── contracts/
│   ├── FeeEarner.sol        # Main contract
│   └── MockERC20.sol        # Mock token for testing
├── scripts/
│   ├── deploy.js            # Deployment script
│   ├── upgrade.js           # Upgrade script
├── test/
│   └── FeeEarner.test.js    # Test suite
├── hardhat.config.js        # Hardhat configuration
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies
└── README.md                # Documentation
```

### Testing Checklist

- [x] Deployment and initialization
- [x] User contributions
- [x] Token management (add/remove)
- [x] Liquidity manager management
- [x] Withdrawal functions
- [x] Pause/unpause functionality
- [x] Ownership transfer
- [x] Upgradeability
- [x] Access control
- [x] Edge cases and error handling

## Gas Optimization

- Uses `mapping` for O(1) lookups
- Efficient storage layout with `__gap` for upgrades
- Batch operations (withdrawAll) to reduce transaction count
- SafeERC20 for secure token transfers

## Upgrade Process

1. Deploy new implementation contract
2. Call `upgradeProxy` with new implementation address
3. Verify state preservation
4. Test all functions on upgraded contract
5. Verify new implementation on block explorer

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

## Disclaimer

This contract has been developed with security best practices, but has not been audited. Use at your own risk. Always conduct thorough testing and consider a professional audit before deploying to mainnet.

