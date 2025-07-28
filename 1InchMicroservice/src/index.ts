/**
 * 1Inch Microservice for PrivateRPC
 * 
 * This microservice acts as a bridge between the PrivateRPC system and the 1inch protocol.
 * It handles the creation of escrows for atomic swaps between ETH and XMR using the
 * SwapCreatorAdapter contract deployed on Base Sepolia and communicates with the
 * SwapD daemon for XMR-ETH atomic swaps.
 */

import express from 'express';
import dotenv from 'dotenv';
import * as ethers from 'ethers';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { 
  FusionSDK, 
  NetworkEnum, 
  Web3Like, 
  PrivateKeyProviderConnector,
  OrderStatus,
  BlockchainProviderConnector
} from '@1inch/fusion-sdk';
import SwapDClient from './swapd-client';

// Load environment variables
dotenv.config();

// Constants
const PORT = process.env.PORT || 3000;
const SWAP_CREATOR_ADAPTER_ADDRESS = '0x14Ab64a2f29f4921c200280988eea59c85266A33';
const SWAP_CREATOR_ADDRESS = '0x07b9c8BF96E553Adec406cC6ab8c41CCD3d53a51';
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

// 1inch API key - needed for the Fusion SDK
const DEV_PORTAL_API_TOKEN = process.env.ONEINCH_API_KEY || '';

// SwapD JSON-RPC endpoint
const SWAPD_RPC_URL = process.env.SWAPD_RPC_URL || 'http://127.0.0.1:5000';

// Base Sepolia chain ID (for 1inch SDK)
// Note: 1inch Fusion SDK doesn't directly support Base yet, so we use ETHEREUM
// as a fallback. In production, consider using direct API calls to 1inch if needed.
const NETWORK = NetworkEnum.ETHEREUM;

// Base Sepolia Chain ID - used for manual API calls if needed
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Initialize Express app
const app = express();

// Add security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
}));

// Add rate limiting to protect against abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.'
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Initialize Ethereum provider
const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);

// Initialize wallet for 1inch Fusion SDK
const privateKey = process.env.PRIVATE_KEY || '';
const wallet = new ethers.Wallet(privateKey, provider);

// Create a provider connector for the 1inch Fusion SDK
const ethersProviderConnector: Web3Like = {
  eth: {
    call(transactionConfig: any): Promise<string> {
      return provider.call(transactionConfig);
    }
  },
  extend(): void {}
};

// Create a private key provider connector
const connector = new PrivateKeyProviderConnector(
  privateKey,
  ethersProviderConnector
);

// Initialize 1inch Fusion SDK
const fusionSdk = new FusionSDK({
  url: 'https://api.1inch.dev/fusion',
  network: NETWORK,
  blockchainProvider: connector,
  authKey: DEV_PORTAL_API_TOKEN
});

// Initialize SwapD client
const swapdClient = new SwapDClient(SWAPD_RPC_URL);

// Define the interface for SwapCreatorAdapter contract
interface SwapCreatorAdapterInterface extends ethers.BaseContract {
  createEscrow(
    salt: string,
    recipient: string,
    amount: string | bigint,
    srcToken: string,
    dstToken: string,
    deadline: number,
    delay: number,
    extraData: string,
    overrides?: ethers.Overrides
  ): Promise<ethers.ContractTransactionResponse>;
  
  predictEscrowAddress(
    salt: string,
    recipient: string,
    amount: string | bigint,
    srcToken: string,
    dstToken: string,
    deadline: number,
    delay: number,
    extraData: string
  ): Promise<string>;
}

// ABI for SwapCreatorAdapter
const SWAP_CREATOR_ADAPTER_ABI = [
  "function createEscrow(bytes32,address,uint256,address,address,uint48,uint48,bytes) external payable",
  "function predictEscrowAddress(bytes32,address,uint256,address,address,uint48,uint48,bytes) external view returns (address)"
];

// Initialize contract instance with the proper interface
const swapCreatorAdapter = new ethers.Contract(
  SWAP_CREATOR_ADAPTER_ADDRESS,
  SWAP_CREATOR_ADAPTER_ABI,
  provider
) as unknown as SwapCreatorAdapterInterface;

/**
 * Enhanced health check endpoint that pings both SwapD and 1inch
 */
app.get('/health', async (req, res) => {
  try {
    // Check SwapD status
    let swapdStatus = 'unknown';
    try {
      const pingResult = await swapdClient.ping();
      swapdStatus = pingResult ? 'ok' : 'error';
    } catch (error: unknown) {
      swapdStatus = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      req.log.error({ error: errorMessage }, 'SwapD health check failed');
    }
    
    // Check 1inch API status
    let oneinchStatus = 'unknown';
    try {
      const response = await axios.get('https://api.1inch.dev/healthcheck', {
        headers: { 'Authorization': `Bearer ${DEV_PORTAL_API_TOKEN}` }
      });
      oneinchStatus = response.status === 200 ? 'ok' : 'error';
    } catch (error: unknown) {
      oneinchStatus = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      req.log.error({ error: errorMessage }, '1inch health check failed');
    }
    
    // Check provider status
    let providerStatus = 'unknown';
    try {
      await provider.getBlockNumber();
      providerStatus = 'ok';
    } catch (error: unknown) {
      providerStatus = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      req.log.error({ error: errorMessage }, 'Provider health check failed');
    }
    
    const overallStatus = swapdStatus === 'ok' && oneinchStatus === 'ok' && providerStatus === 'ok' ? 'ok' : 'degraded';
    
    res.status(overallStatus === 'ok' ? 200 : 207).json({
      status: overallStatus,
      components: {
        swapd: swapdStatus,
        oneinch: oneinchStatus,
        provider: providerStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    req.log.error({ error: errorMessage }, 'Health check failed');
    res.status(500).json({ status: 'error', error: errorMessage });
  }
});

/**
 * Create a new escrow for an atomic swap using 1inch Fusion SDK
 * 
 * This endpoint creates a swap order using the 1inch Fusion SDK and then
 * uses the SwapCreatorAdapter to create an escrow for the atomic swap.
 */
app.post('/escrow', async (req, res) => {
  try {
    // Extract and validate parameters from request body
    const { 
      fromTokenAddress, 
      toTokenAddress, 
      amount,
      recipient,
      deadline
    } = req.body;
    
    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: fromTokenAddress, toTokenAddress, amount'
      });
    }
    
    // Get wallet address from the private key
    const walletAddress = wallet.address;
    
    // Step 1: Get a quote from 1inch Fusion API
    const quoteParams = {
      fromTokenAddress,
      toTokenAddress,
      amount,
      walletAddress,
      source: 'privaterpc-microservice'
    };
    
    console.log('Getting quote from 1inch Fusion API...');
    const quote = await fusionSdk.getQuote(quoteParams);
    console.log('Quote received:', quote);
    
    // Step 2: Create an order based on the quote
    console.log('Creating order...');
    const preparedOrder = await fusionSdk.createOrder(quoteParams);
    console.log('Order created:', preparedOrder);
    
    // Step 3: Submit the order to 1inch Fusion API
    console.log('Submitting order...');
    const orderInfo = await fusionSdk.submitOrder(preparedOrder.order, preparedOrder.quoteId);
    console.log('Order submitted:', orderInfo);
    
    // Step 4: Generate claim and refund conditions for the SwapCreatorAdapter
    // These would be based on the 1inch order details
    const claimCondition = ethers.keccak256(ethers.toUtf8Bytes('claim-' + orderInfo.orderHash));
    const refundCondition = ethers.keccak256(ethers.toUtf8Bytes('refund-' + orderInfo.orderHash));
    const nonce = Date.now(); // Use timestamp as nonce for simplicity
    
    // Step 5: Connect to the SwapCreatorAdapter contract with the wallet
    const connectedContract = new ethers.Contract(
      SWAP_CREATOR_ADAPTER_ADDRESS,
      SWAP_CREATOR_ADAPTER_ABI,
      wallet.connect(provider)
    ) as unknown as SwapCreatorAdapterInterface;
    
    // Step 6: Encode the extra data for the createEscrow function
    const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'uint256'],
      [claimCondition, refundCondition, nonce]
    );
    
    // Step 7: Prepare transaction parameters
    // Generate a unique salt based on the order hash to ensure uniqueness
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`salt-${orderInfo.orderHash}-${Date.now()}`));
    const recipientAddress = req.body.recipient || walletAddress;
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + (req.body.deadline || 3600); // Default 1 hour
    
    // Ensure amount is properly handled as wei
    const amountBigInt = ethers.getBigInt(amount.toString());
    
    // Only include value if we're dealing with native ETH
    const txOptions: ethers.Overrides = {};
    if (fromTokenAddress === ethers.ZeroAddress) {
      txOptions.value = amountBigInt;
    }
    
    // Step 8: Call createEscrow function with appropriate parameters
    console.log('Creating escrow with SwapCreatorAdapter...');
    const tx = await connectedContract.createEscrow(
      salt,
      recipientAddress,
      amountBigInt,
      fromTokenAddress,
      toTokenAddress,
      deadlineTimestamp,
      0, // No delay for now, can be parameterized later
      extraData, // extraData containing claim and refund conditions
      txOptions
    );
    
    // Step 8: Wait for transaction confirmation
    console.log('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt);
    
    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }
    
    // Return the response with all relevant information
    res.status(200).json({
      status: 'success',
      message: 'Escrow created successfully',
      orderHash: orderInfo.orderHash,
      transactionHash: receipt.hash,
      escrowDetails: {
        claimCondition,
        refundCondition,
        nonce,
        recipient: recipient || walletAddress,
        amount,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress
      }
    });
  } catch (error) {
    console.error('Error creating escrow:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create escrow',
      error: (error as Error).message
    });
  }
});

/**
 * Predict the escrow address for a potential swap
 * 
 * This endpoint simulates the process of creating an escrow and returns the predicted address
 * without actually submitting any transactions.
 */
app.get('/predict-escrow', async (req, res) => {
  try {
    // Extract and validate parameters from request query
    const fromTokenAddress = req.query.fromTokenAddress as string;
    const toTokenAddress = req.query.toTokenAddress as string;
    const amount = req.query.amount as string;
    const recipient = req.query.recipient as string;
    
    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: fromTokenAddress, toTokenAddress, amount'
      });
    }
    
    // Get wallet address from the private key
    const walletAddress = wallet.address;
    
    // Generate mock claim and refund conditions for prediction
    // In a real scenario, these would be derived from the 1inch order
    const mockOrderHash = ethers.keccak256(ethers.toUtf8Bytes(`${fromTokenAddress}-${toTokenAddress}-${amount}-${Date.now()}`));
    const claimCondition = ethers.keccak256(ethers.toUtf8Bytes('claim-' + mockOrderHash));
    const refundCondition = ethers.keccak256(ethers.toUtf8Bytes('refund-' + mockOrderHash));
    const nonce = Date.now(); // Use timestamp as nonce for simplicity
    
    // Encode the extra data for the predictEscrowAddress function
    const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'uint256'],
      [claimCondition, refundCondition, nonce]
    );
    
    // Call predictEscrowAddress function with appropriate parameters
    const predictedAddress = await swapCreatorAdapter.predictEscrowAddress(
      ethers.ZeroHash, // salt (not used by SwapCreatorAdapter)
      recipient || walletAddress, // recipient
      amount, // amount
      fromTokenAddress, // srcToken
      toTokenAddress, // dstToken
      Math.floor(Date.now() / 1000) + 3600, // deadline (1 hour from now)
      0, // delay (not used by SwapCreatorAdapter)
      extraData // extraData containing claim and refund conditions
    );
    
    // Get a quote from 1inch Fusion API to provide additional information
    const quoteParams = {
      fromTokenAddress,
      toTokenAddress,
      amount,
      walletAddress: recipient || walletAddress,
      source: 'privaterpc-microservice'
    };
    
    let quote;
    try {
      quote = await fusionSdk.getQuote(quoteParams);
    } catch (quoteError) {
      console.warn('Failed to get quote from 1inch:', quoteError);
      // Continue without the quote
    }
    
    // Return the response with all relevant information
    res.status(200).json({
      status: 'success',
      predictedAddress,
      escrowDetails: {
        claimCondition,
        refundCondition,
        nonce,
        recipient: recipient || walletAddress,
        amount,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress
      },
      quote: quote || { message: 'Quote not available' }
    });
  } catch (error) {
    console.error('Error predicting escrow address:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to predict escrow address',
      error: (error as Error).message
    });
  }
});

/**
 * Get the status of an existing escrow
 * 
 * This endpoint checks the status of a 1inch Fusion order and returns the current state.
 */
app.get('/escrow/:orderHash', async (req, res) => {
  try {
    const orderHash = req.params.orderHash;
    
    if (!orderHash) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: orderHash'
      });
    }
    
    // Get the order status from 1inch Fusion API
    try {
      const orderStatus = await fusionSdk.getOrderStatus(orderHash);
      
      // Return the order status with additional information
      res.status(200).json({
        status: 'success',
        orderHash,
        orderStatus,
        statusDescription: getOrderStatusDescription(orderStatus.status),
        lastCheckedAt: new Date().toISOString()
      });
    } catch (orderError) {
      // If the order is not found or there's an error with the 1inch API
      res.status(404).json({
        status: 'error',
        message: 'Order not found or error retrieving order status',
        orderHash,
        error: (orderError as Error).message
      });
    }
  } catch (error) {
    console.error('Error getting escrow status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get escrow status',
      error: (error as Error).message
    });
  }
});

/**
 * Helper function to get a human-readable description of the order status
 */
function getOrderStatusDescription(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Filled:
      return 'The order has been successfully filled.';
    case OrderStatus.Cancelled:
      return 'The order has been cancelled.';
    case OrderStatus.Expired:
      return 'The order has expired.';
    // Note: The SDK might have different status values than what's documented
    // Handle additional statuses if needed
    default:
      return `Status: ${status}`;
  }
}

/**
 * SwapD Integration Endpoints
 */

/**
 * Get all available swap offers from the network
 */
app.get('/swapd/offers', async (req, res) => {
  try {
    const searchTime = req.query.searchTime ? parseInt(req.query.searchTime as string) : 12;
    const result = await swapdClient.queryAllOffers(searchTime);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching swap offers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch swap offers',
      error: (error as Error).message
    });
  }
});

/**
 * Get offers from a specific peer
 */
app.get('/swapd/peer/:peerID/offers', async (req, res) => {
  try {
    const { peerID } = req.params;
    const result = await swapdClient.queryPeerOffers(peerID);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching peer offers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch peer offers',
      error: (error as Error).message
    });
  }
});

/**
 * Create a new swap offer on the network
 */
app.post('/swapd/offers', async (req, res) => {
  try {
    const { minAmount, maxAmount, exchangeRate, ethAsset, relayerEndpoint, relayerFee } = req.body;
    
    if (!minAmount || !maxAmount || !exchangeRate) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: minAmount, maxAmount, exchangeRate'
      });
    }
    
    const result = await swapdClient.makeOffer(
      minAmount,
      maxAmount,
      exchangeRate,
      ethAsset,
      relayerEndpoint,
      relayerFee
    );
    
    res.status(201).json({
      status: 'success',
      message: 'Swap offer created successfully',
      ...result
    });
  } catch (error) {
    console.error('Error creating swap offer:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create swap offer',
      error: (error as Error).message
    });
  }
});

/**
 * Take an existing swap offer
 */
app.post('/swapd/offers/:offerID/take', async (req, res) => {
  try {
    const { offerID } = req.params;
    const { peerID, providesAmount } = req.body;
    
    if (!peerID || !providesAmount) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameters: peerID, providesAmount'
      });
    }
    
    await swapdClient.takeOffer(peerID, offerID, providesAmount);
    
    res.status(200).json({
      status: 'success',
      message: 'Swap offer taken successfully',
      offerID,
      peerID
    });
  } catch (error) {
    console.error('Error taking swap offer:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to take swap offer',
      error: (error as Error).message
    });
  }
});

/**
 * Get ongoing swaps
 */
app.get('/swapd/swaps/ongoing', async (req, res) => {
  try {
    const offerID = req.query.offerID as string;
    const result = await swapdClient.getOngoingSwaps(offerID);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching ongoing swaps:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch ongoing swaps',
      error: (error as Error).message
    });
  }
});

/**
 * Get past swaps
 */
app.get('/swapd/swaps/past', async (req, res) => {
  try {
    const offerID = req.query.offerID as string;
    const result = await swapdClient.getPastSwaps(offerID);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching past swaps:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch past swaps',
      error: (error as Error).message
    });
  }
});

/**
 * Get swap status
 */
app.get('/swapd/swaps/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await swapdClient.getSwapStatus(id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching swap status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch swap status',
      error: (error as Error).message
    });
  }
});

/**
 * Integrated endpoint to create a complete XMR-ETH atomic swap using both 1inch and SwapD
 */
app.post('/integrated/swap', async (req, res) => {
  try {
    const {
      // 1inch parameters
      tokenAddress,
      amount,
      walletAddress,
      deadline,
      
      // SwapD parameters
      minAmount,
      maxAmount,
      exchangeRate,
      ethAsset,
      relayerEndpoint,
      relayerFee
    } = req.body;
    
    // Validate required parameters
    if (!tokenAddress || !amount || !walletAddress || !deadline) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required 1inch parameters: tokenAddress, amount, walletAddress, deadline'
      });
    }
    
    if (!minAmount || !maxAmount || !exchangeRate) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required SwapD parameters: minAmount, maxAmount, exchangeRate'
      });
    }
    
    // Step 1: Create a SwapD offer
    console.log('Creating SwapD offer...');
    const swapOffer = await swapdClient.makeOffer(
      minAmount,
      maxAmount,
      exchangeRate,
      ethAsset,
      relayerEndpoint,
      relayerFee
    );
    
    if (!swapOffer || !swapOffer.offerID) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create SwapD offer'
      });
    }
    
    // Step 2: Generate claim and refund conditions for the 1inch escrow
    const nonce = Math.floor(Math.random() * 1000000000);
    const claimCondition = ethers.keccak256(ethers.toUtf8Bytes(`claim-${swapOffer.offerID}-${nonce}`));
    const refundCondition = ethers.keccak256(ethers.toUtf8Bytes(`refund-${swapOffer.offerID}-${nonce}`));
    
    // Step 3: Create 1inch escrow with the SwapCreatorAdapter
    console.log('Creating 1inch escrow...');
    const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'uint256'],
      [claimCondition, refundCondition, nonce]
    );
    
    // Prepare order parameters for 1inch Fusion SDK
    const orderParams = {
      fromTokenAddress: tokenAddress,
      toTokenAddress: ethers.ZeroAddress, // ETH
      amount: amount,
      walletAddress: walletAddress,
      expireDate: Math.floor(Date.now() / 1000) + (deadline || 3600), // Default 1 hour
      extraData: extraData
    };
    
    // Create the order using 1inch Fusion SDK
    const order = await fusionSdk.createOrder(orderParams);
    
    // Return the integrated response with both SwapD and 1inch details
    res.status(201).json({
      status: 'success',
      message: 'Integrated atomic swap created successfully',
      swapd: swapOffer,
      oneInch: {
        order: order,
        orderParams: orderParams,
        claimCondition,
        refundCondition,
        nonce
      }
    });
  } catch (error) {
    console.error('Error creating integrated atomic swap:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create integrated atomic swap',
      error: (error as Error).message
    });
  }
});

/**
 * Cancel a swap
 */
app.post('/swapd/swaps/:offerID/cancel', async (req, res) => {
  try {
    const { offerID } = req.params;
    const result = await swapdClient.cancelSwap(offerID);
    res.status(200).json({
      success: true,
      message: 'Swap cancelled successfully',
      result
    });
  } catch (error) {
    console.error('Error cancelling swap:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel swap',
      error: (error as Error).message
    });
  }
});

/**
 * Get suggested exchange rate
 */
app.get('/swapd/exchange-rate', async (req, res) => {
  try {
    const result = await swapdClient.getSuggestedExchangeRate();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch exchange rate',
      error: (error as Error).message
    });
  }
});

/**
 * Get wallet balances
 */
app.get('/swapd/balances', async (req, res) => {
  try {
    const result = await swapdClient.getBalances();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching balances:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch balances',
      error: (error as Error).message
    });
  }
});

/**
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`🚀 1Inch Microservice running on port ${PORT}`);
  console.log(`📝 SwapCreatorAdapter address: ${SWAP_CREATOR_ADAPTER_ADDRESS}`);
  console.log(`📝 SwapCreator address: ${SWAP_CREATOR_ADDRESS}`);
  console.log(`🔄 Connected to SwapD at: ${SWAPD_RPC_URL}`);
});

/**
 * Get status of an integrated swap (both 1inch and SwapD)
 */
app.get('/integrated/swap/:orderHash/:swapId', async (req, res) => {
  try {
    const { orderHash, swapId } = req.params;
    
    // Get 1inch order status
    console.log('Fetching 1inch order status...');
    let oneInchStatus;
    try {
      const orderStatus = await fusionSdk.getOrderStatus(orderHash);
      // Convert OrderStatusResponse to OrderStatus enum value for description
      const statusEnum = convertToOrderStatus(orderStatus);
      oneInchStatus = {
        status: orderStatus,
        statusEnum,
        description: getOrderStatusDescription(statusEnum)
      };
    } catch (error) {
      console.error('Error fetching 1inch order status:', error);
      oneInchStatus = {
        status: 'ERROR',
        description: 'Failed to fetch 1inch order status',
        error: (error as Error).message
      };
    }
    
    // Get SwapD swap status
    console.log('Fetching SwapD swap status...');
    let swapdStatus;
    try {
      swapdStatus = await swapdClient.getSwapStatus(swapId);
    } catch (error) {
      console.error('Error fetching SwapD swap status:', error);
      swapdStatus = {
        status: 'ERROR',
        description: 'Failed to fetch SwapD swap status',
        error: (error as Error).message
      };
    }
    
    // Determine overall status
    let overallStatus = 'PENDING';
    if (oneInchStatus.status === OrderStatus.Filled && swapdStatus?.status === 'COMPLETED') {
      overallStatus = 'COMPLETED';
    } else if (oneInchStatus.status === OrderStatus.Cancelled || swapdStatus?.status === 'CANCELLED') {
      overallStatus = 'CANCELLED';
    } else if (oneInchStatus.status === OrderStatus.Expired || swapdStatus?.status === 'EXPIRED') {
      overallStatus = 'EXPIRED';
    } else if (oneInchStatus.status === 'ERROR' || swapdStatus?.status === 'ERROR') {
      overallStatus = 'ERROR';
    }
    
    res.status(200).json({
      overallStatus,
      oneInch: oneInchStatus,
      swapd: swapdStatus
    });
  } catch (error) {
    console.error('Error fetching integrated swap status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch integrated swap status',
      error: (error as Error).message
    });
  }
});

/**
 * Helper function to safely convert OrderStatusResponse to OrderStatus
 */
function convertToOrderStatus(statusResponse: any): OrderStatus {
  // If it's already an OrderStatus enum value, return it
  if (Object.values(OrderStatus).includes(statusResponse)) {
    return statusResponse as OrderStatus;
  }
  
  // Try to convert from string/number to OrderStatus
  const statusValue = parseInt(statusResponse.toString());
  
  switch (statusValue) {
    case 0:
      return OrderStatus.Pending;
    case 1:
      return OrderStatus.Filled;
    case 2:
      return OrderStatus.Cancelled;
    case 3:
      return OrderStatus.Expired;
    default:
      return OrderStatus.Pending; // Default to Pending if unknown
  }
}

/**
 * TODO: Implement additional helper functions
 * 
 * 1. Function to handle callbacks for successful/failed swaps
 * 2. Error handling and logging
 */

/**
 * TODO: Implement proper error handling and logging
 * 
 * 1. Set up a logging system (e.g., Winston)
 * 2. Implement request validation middleware
 * 3. Add proper error handling middleware
 * 4. Implement rate limiting
 */

/**
 * TODO: Add authentication and security
 * 
 * 1. Implement API key authentication
 * 2. Add request validation
 * 3. Implement CORS
 * 4. Add request rate limiting
 */

export default app;
