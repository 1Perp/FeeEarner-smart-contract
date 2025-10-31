// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FeeEarner
 * @notice A sponsorship contract that allows users to contribute ERC20 tokens
 * @dev Implements UUPS upgradeable pattern with role-based access control
 */
contract FeeEarner is 
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Address of the liquidity manager who can withdraw funds
    address private liquidityManager;

    /// @notice Array of allowed token addresses
    address[] private allowedTokens;

    /// @notice Mapping to check if a token is allowed
    mapping(address => bool) private isTokenAllowed;

    /// @notice Maximum number of allowed tokens
    uint256 private constant MAX_TOKENS = 20;

    /// @notice Mapping of user contributions: user => token => amount
    mapping(address => mapping(address => uint256)) private userContributions;

    /// @notice Mapping of total contributions per token: token => total amount
    mapping(address => uint256) private totalContributions;

    /// @notice Storage gap for future upgrades
    uint256[50] private __gap;

    // Events
    event Contribution(address indexed user, address indexed token, uint256 amount);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event LiquidityManagerUpdated(address indexed oldManager, address indexed newManager);
    event Withdrawal(address indexed token, uint256 amount, address indexed to);

    // Errors
    error ZeroAddress();
    error ZeroAmount();
    error TokenNotAllowed();
    error TokenAlreadyAdded();
    error TokenNotFound();
    error MaxTokensReached();
    error InsufficientBalance();
    error NotLiquidityManager();
    error TokenHasBalance();

    /// @notice Modifier to restrict access to liquidity manager only
    modifier onlyLiquidityManager() {
        if (msg.sender != liquidityManager) revert NotLiquidityManager();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param initialOwner Address of the initial owner
     * @param initialLiquidityManager Address of the initial liquidity manager
     * @param initialTokens Array of initial allowed token addresses
     */
    function initialize(
        address initialOwner,
        address initialLiquidityManager,
        address[] memory initialTokens
    ) public initializer {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (initialLiquidityManager == address(0)) revert ZeroAddress();
        if (initialTokens.length > MAX_TOKENS) revert MaxTokensReached();

        __Ownable_init(initialOwner);
        __Ownable2Step_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        liquidityManager = initialLiquidityManager;

        // Add initial tokens
        for (uint256 i = 0; i < initialTokens.length; i++) {
            if (isTokenAllowed[initialTokens[i]]) revert TokenAlreadyAdded();
            _addToken(initialTokens[i]);
        }
    }

    /**
     * @notice Contribute ERC20 tokens to the contract
     * @param token Address of the ERC20 token
     * @param amount Amount of tokens to contribute
     */
    function contribute(address token, uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!isTokenAllowed[token]) revert TokenNotAllowed();

        // Transfer tokens from user to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Update contributions
        userContributions[msg.sender][token] += amount;
        totalContributions[token] += amount;

        emit Contribution(msg.sender, token, amount);
    }

    /**
     * @notice Get a user's contribution for a specific token
     * @param user Address of the user
     * @param token Address of the token
     * @return Amount contributed by the user
     */
    function getUserContribution(address user, address token)
        external
        view
        returns (uint256)
    {
        return userContributions[user][token];
    }

    /**
     * @notice Get total contributions for a specific token
     * @param token Address of the token
     * @return Total amount contributed
     */
    function getTotalContribution(address token) 
        external 
        view 
        returns (uint256) 
    {
        return totalContributions[token];
    }

    /**
     * @notice Get all allowed tokens
     * @return Array of allowed token addresses
     */
    function getAllowedTokens() external view returns (address[] memory) {
        return allowedTokens;
    }

    /**
     * @notice Check if a token is allowed
     * @param token Address of the token
     * @return True if token is allowed
     */
    function isAllowedToken(address token) external view returns (bool) {
        return isTokenAllowed[token];
    }

    /**
     * @notice Get the contract's current balance of a specific ERC20 token
     * @param token Address of the ERC20 token
     * @return The contract's token balance
     */
    function getTokenBalance(address token)
        external
        view
        returns (uint256)
    {
        if (token == address(0)) revert ZeroAddress();
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Get the liquidity manager address
     * @return Address of the liquidity manager
     */
    function getLiquidityManager() external view returns (address) {
        return liquidityManager;
    }

    /**
     * @notice Add a token to the allowed list
     * @param token Address of the token to add
     */
    function addAllowedToken(address token) external onlyOwner {
        if (isTokenAllowed[token]) revert TokenAlreadyAdded();
        if (allowedTokens.length >= MAX_TOKENS) revert MaxTokensReached();

        _addToken(token);
    }

    /**
     * @notice Remove a token from the allowed list
     * @param token Address of the token to remove
     */
    function removeAllowedToken(address token) external onlyOwner {
        if (!isTokenAllowed[token]) revert TokenNotFound();

        isTokenAllowed[token] = false;

        // Remove from array
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            if (allowedTokens[i] == token) {
                allowedTokens[i] = allowedTokens[allowedTokens.length - 1];
                allowedTokens.pop();
                break;
            }
        }

        emit TokenRemoved(token);
    }

    /**
     * @notice Set a new liquidity manager
     * @param newManager Address of the new liquidity manager
     */
    function setLiquidityManager(address newManager) external onlyOwner {
        if (newManager == address(0)) revert ZeroAddress();
        
        address oldManager = liquidityManager;
        liquidityManager = newManager;

        emit LiquidityManagerUpdated(oldManager, newManager);
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw specific amount of a token
     * @param token Address of the token to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) 
        external 
        onlyLiquidityManager 
        nonReentrant 
    {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();

        IERC20(token).safeTransfer(liquidityManager, amount);

        emit Withdrawal(token, amount, liquidityManager);
    }

    /**
     * @notice Withdraw all tokens from the contract
     */
    function withdrawAll() external onlyLiquidityManager nonReentrant {
        uint256 length = allowedTokens.length;
        
        for (uint256 i = 0; i < length; i++) {
            address token = allowedTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            
            if (balance > 0) {
                IERC20(token).safeTransfer(liquidityManager, balance);
                emit Withdrawal(token, balance, liquidityManager);
            }
        }
    }

    /**
     * @notice Internal function to add a token
     * @param token Address of the token to add
     */
    function _addToken(address token) private {
        if (token == address(0)) revert ZeroAddress();
        
        allowedTokens.push(token);
        isTokenAllowed[token] = true;

        emit TokenAdded(token);
    }

    /**
     * @notice Authorize upgrade to new implementation
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyOwner 
    {}

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

}

