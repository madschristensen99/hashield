const { ethers } = require('ethers');
const crypto = require('crypto');
require('dotenv').config();

// Check for required environment variables
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL) {
  console.error('ERROR: BASE_SEPOLIA_RPC_URL environment variable is not set');
  console.error('Please set BASE_SEPOLIA_RPC_URL in your .env file');
}

if (!PRIVATE_KEY) {
  console.error('ERROR: PRIVATE_KEY environment variable is not set');
  console.error('Please set PRIVATE_KEY in your .env file');
}

// ABI for the LimitOrderProtocol contract (partial, focusing on fillOrder and other necessary functions)
const limitOrderProtocolABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "salt", "type": "uint256" },
          { "name": "maker", "type": "address" },
          { "name": "receiver", "type": "address" },
          { "name": "makerAsset", "type": "address" },
          { "name": "takerAsset", "type": "address" },
          { "name": "makingAmount", "type": "uint256" },
          { "name": "takingAmount", "type": "uint256" },
          { "name": "makerTraits", "type": "uint256" }
        ],
        "name": "order",
        "type": "tuple"
      },
      { "name": "r", "type": "bytes32" },
      { "name": "vs", "type": "bytes32" },
      { "name": "amount", "type": "uint256" },
      { "name": "takerTraits", "type": "uint256" }
    ],
    "name": "fillOrder",
    "outputs": [
      { "name": "", "type": "uint256" },
      { "name": "", "type": "uint256" },
      { "name": "", "type": "bytes32" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DOMAIN_SEPARATOR",
    "outputs": [{ "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// EIP-712 type definitions for the order
const EIP712_ORDER_TYPE = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'makerAsset', type: 'address' },
    { name: 'takerAsset', type: 'address' },
    { name: 'makingAmount', type: 'uint256' },
    { name: 'takingAmount', type: 'uint256' },
    { name: 'makerTraits', type: 'uint256' }
  ]
};

// Contract addresses on Base Sepolia
const CONTRACT_ADDRESS = '0xE53136D9De56672e8D2665C98653AC7b8A60Dc44'; // LimitOrderProtocol
const SWAP_CREATOR_ADDRESS = '0x212072CB504Dc2fBF6477772B8E318D286B80e35'; // SwapCreator
const XMR_ESCROW_SRC_ADDRESS = '0x8c39940feBc35F0A44868c3B3E138C58989944a1'; // XMREscrowSrc
const XMR_ESCROW_DST_ADDRESS = '0xA81283f4E4FB8eDd1cF497C09ABcFa8bBe9289Ea'; // XMREscrowDst
const RESOLVER_ADDRESS = '0x569961856A3f66788D29e70aeaB7400f11895f4A'; // Resolver

/**
 * Validates that all required environment variables are set
 */
function validateEnvironment() {
  if (!RPC_URL) {
    console.error('Missing RPC_URL environment variable');
    throw new Error('Missing RPC_URL environment variable');
  }
  
  if (!PRIVATE_KEY) {
    console.error('Missing PRIVATE_KEY environment variable');
    throw new Error('Missing PRIVATE_KEY environment variable');
  }
}

/**
 * Calculates the EIP-712 hash of an order
 * @param {Object} order - The order object
 * @param {string} domainSeparator - The domain separator from the contract
 * @returns {string} - The order hash
 */
function getOrderHash(order, domainSeparator) {
  // Encode order parameters according to EIP-712
  const orderTypeHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(
      'Order(uint256 salt,address maker,address receiver,address makerAsset,address takerAsset,uint256 makingAmount,uint256 takingAmount,uint256 makerTraits)'
    )
  );

  const encodedOrder = ethers.utils.defaultAbiCoder.encode(
    ['bytes32', 'uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
    [
      orderTypeHash,
      order.salt,
      order.maker,
      order.receiver,
      order.makerAsset,
      order.takerAsset,
      order.makingAmount,
      order.takingAmount,
      order.makerTraits
    ]
  );

  const orderHash = ethers.utils.keccak256(encodedOrder);
  
  // Combine with domain separator according to EIP-712
  return ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['string', 'bytes32', 'bytes32'],
      ['\x19\x01', domainSeparator, orderHash]
    )
  );
}

/**
 * Generates claim and refund secrets for Monero swaps
 * @returns {Object} - The generated secrets and their hashes
 */
function generateSwapSecrets() {
  // Generate random secrets for claim and refund
  const claimSecret = '0x' + crypto.randomBytes(32).toString('hex');
  const refundSecret = '0x' + crypto.randomBytes(32).toString('hex');
  
  // Calculate hashes of the secrets
  const claimSecretHash = ethers.utils.keccak256(claimSecret);
  const refundSecretHash = ethers.utils.keccak256(refundSecret);
  
  return {
    claimSecret,
    claimSecretHash,
    refundSecret,
    refundSecretHash
  };
}

/**
 * Encodes Monero-specific data for inclusion in the order
 * @param {string} xmrAddress - The Monero address
 * @param {string} claimSecretHash - Hash of the claim secret
 * @param {string} refundSecretHash - Hash of the refund secret
 * @returns {string} - Encoded interaction data
 */
function encodeMoneroData(xmrAddress, claimSecretHash, refundSecretHash) {
  // Encode the Monero address and secret hashes as interaction data
  return ethers.utils.defaultAbiCoder.encode(
    ['string', 'bytes32', 'bytes32'],
    [xmrAddress, claimSecretHash, refundSecretHash]
  );
}

/**
 * Signs an order using the wallet
 * @param {Object} order - The order object
 * @param {Object} wallet - The ethers.js wallet object
 * @returns {Object} - The signature components (r, vs)
 */
async function signOrder(order, wallet) {
  if (!wallet) {
    throw new Error('Wallet is required for signing orders');
  }
  
  try {
    // Get domain separator from contract
    const contract = new ethers.Contract(CONTRACT_ADDRESS, limitOrderProtocolABI, wallet);
    const domainSeparator = await contract.DOMAIN_SEPARATOR();
    console.log('Domain separator:', domainSeparator);
    
    // Get the order hash
    const orderHash = getOrderHash(order, domainSeparator);
    console.log('Order hash to sign:', orderHash);
    
    // Sign the hash directly
    const signature = await wallet.signMessage(ethers.utils.arrayify(orderHash));
    console.log('Raw signature:', signature);
    
    // Split signature into r, s, v components
    const sig = ethers.utils.splitSignature(signature);
    console.log('Split signature:', sig);
    
    // Format r and vs as required by the contract
    const r = sig.r;
    
    // The 1inch contract expects vs to be exactly 32 bytes
    // v is the first bit of the first byte, s is the rest
    // First, adjust v (v - 27) so it's either 0 or 1
    const v = sig.v - 27;
    
    // Convert s to a BigInt
    const sBigInt = BigInt(sig.s);
    
    // Shift v left by 255 bits and combine with s
    const vBigInt = BigInt(v);
    const vShifted = vBigInt << 255n;
    const combined = vShifted | sBigInt;
    
    // Convert to hex and ensure it's exactly 32 bytes
    const vs = ethers.utils.hexZeroPad(ethers.utils.hexlify(combined), 32);
    
    console.log('Formatted signature parts:', { r, vs });
    console.log('vs length in bytes:', (vs.length - 2) / 2); // Should be 32 bytes
    
    return {
      r: sig.r,
      vs: vs
    };
  } catch (error) {
    console.error('Error signing order:', error);
    throw error;
  }
}

/**
 * Places an order on the 1inch Limit Order Protocol
 * @param {Object} orderData - The order data
 * @returns {Object} - Transaction result
 */
async function placeOrder(orderData) {
  try {
    // Validate environment variables
    validateEnvironment();
    
    // Connect to the provider and contract
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, limitOrderProtocolABI, wallet);
    
    console.log('Connected to contract at', CONTRACT_ADDRESS);
    console.log('Wallet address:', wallet.address);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.utils.formatEther(balance), 'ETH');
    
    if (balance.eq(0)) {
      throw new Error('Wallet has zero balance. Cannot proceed with transaction.');
    }
    
    // Generate a random salt if not provided
    const salt = orderData.salt || ethers.utils.hexlify(ethers.utils.randomBytes(32));
    
    // Handle Monero-specific data if this is a cross-chain swap
    let interaction = '0x'; // Default empty interaction data
    let swapSecrets = null;
    
    if (orderData.isMoneroSwap) {
      // Generate claim and refund secrets for the swap
      swapSecrets = generateSwapSecrets();
      
      // Encode Monero-specific data (address and secret hashes)
      interaction = encodeMoneroData(
        orderData.xmrAddress || '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A', // Default Monero address if not provided
        swapSecrets.claimSecretHash,
        swapSecrets.refundSecretHash
      );
      
      console.log('Generated swap secrets:', {
        claimSecretHash: swapSecrets.claimSecretHash,
        refundSecretHash: swapSecrets.refundSecretHash
      });
    }
    
    // Create the order object
    const order = {
      salt: salt,
      maker: wallet.address,
      receiver: orderData.isMoneroSwap ? XMR_ESCROW_SRC_ADDRESS : ethers.constants.AddressZero,
      makerAsset: orderData.makerAsset,
      takerAsset: orderData.takerAsset,
      makingAmount: ethers.BigNumber.from(orderData.makingAmount),
      takingAmount: ethers.BigNumber.from(orderData.takingAmount),
      makerTraits: ethers.BigNumber.from(orderData.makerTraits || '0'),
      predicate: orderData.predicate || '0x',
      permit: orderData.permit || '0x',
      interaction: interaction
    };
    
    // If using native ETH, we need to send ETH with the transaction
    const isNativeETH = orderData.makerAsset === '0x0000000000000000000000000000000000000000';
    console.log(`Using ${isNativeETH ? 'native ETH' : 'ERC-20 token'} for the order`);
    
    // If using native ETH, check that value is provided
    if (isNativeETH && !orderData.value) {
      throw new Error('When using native ETH as makerAsset, you must provide a value parameter');
    }
    
    console.log('Creating order:', JSON.stringify(order, null, 2));
    
    // Sign the order
    const signature = await signOrder(order, wallet);
    console.log('Order signed successfully');
    
    // Check if this is a simulation only or if we should skip simulation
    if (orderData.skipSimulation) {
      console.log('Skipping simulation as requested and proceeding directly to transaction submission');
    } else if (orderData.simulateOnly) {
      try {
        console.log('Simulating transaction...');
        
        // Log detailed parameters if requested
        if (orderData.logParams) {
          console.log('\n======== DETAILED PARAMETERS FOR REMIX TESTING ========');
          console.log('Contract Address: 0xE53136D9De56672e8D2665C98653AC7b8A60Dc44');
          console.log('\nOrder struct parameters:');
          console.log('- salt:', order.salt);
          console.log('- maker:', order.maker);
          console.log('- receiver:', order.receiver);
          console.log('- makerAsset:', order.makerAsset);
          console.log('- takerAsset:', order.takerAsset);
          console.log('- makingAmount:', order.makingAmount.toString());
          console.log('- takingAmount:', order.takingAmount.toString());
          console.log('- makerTraits:', order.makerTraits.toString());
          
          console.log('\nSignature parameters:');
          console.log('- r:', signature.r);
          console.log('- vs:', signature.vs);
          
          console.log('\nAdditional parameters:');
          console.log('- amount:', '0'); // Default to 0 for simulation
          console.log('- takerTraits:', '0'); // Default to 0 for simulation
          console.log('- value:', ethers.utils.parseEther(orderData.value || '0').toString());
          
          console.log('\nDomain separator:', domainSeparator);
          console.log('Order hash:', orderHash);
          console.log('======== END DETAILED PARAMETERS ========\n');
        }
        
        // Prepare transaction options
        const txOptions = {};
        
        // If using native ETH, include value in the transaction
        if (isNativeETH && orderData.value) {
          txOptions.value = ethers.utils.parseEther(orderData.value.toString());
          console.log(`Including ${ethers.utils.formatEther(txOptions.value)} ETH in the transaction`);
        }
        
        const gasEstimate = await contract.estimateGas.fillOrder(
          {
            salt: order.salt,
            maker: order.maker,
            receiver: order.receiver,
            makerAsset: order.makerAsset,
            takerAsset: order.takerAsset,
            makingAmount: order.makingAmount,
            takingAmount: order.takingAmount,
            makerTraits: order.makerTraits
          },
          signature.r,
          signature.vs,
          orderData.amount ? ethers.BigNumber.from(orderData.amount) : order.makingAmount,
          ethers.BigNumber.from(orderData.takerTraits || '0'),
          txOptions
        );
        
        console.log(`Gas estimate: ${gasEstimate.toString()}`);
        return {
          simulation: true,
          valid: true,
          gasEstimate: gasEstimate.toString()
        };
      } catch (error) {
        console.error('Simulation failed:', error);
        console.error('Order validation failed:', error.message);
        return {
          simulation: true,
          valid: false,
          error: error.message,
          reason: error.reason || 'Unknown error'
        };
      }
    }
    
    console.log('Submitting transaction...');
    
    try {
      // Set explicit gas limit to avoid unpredictable gas limit errors
      const gasLimit = orderData.gasLimit || 500000; // Default gas limit if not provided
      
      // Prepare transaction options
      const txOptions = { gasLimit };
      
      // If using native ETH, include value in the transaction
      if (isNativeETH && orderData.value) {
        txOptions.value = ethers.utils.parseEther(orderData.value.toString());
        console.log(`Including ${ethers.utils.formatEther(txOptions.value)} ETH in the transaction`);
      }
      
      const tx = await contract.fillOrder(
        {
          salt: order.salt,
          maker: order.maker,
          receiver: order.receiver,
          makerAsset: order.makerAsset,
          takerAsset: order.takerAsset,
          makingAmount: order.makingAmount,
          takingAmount: order.takingAmount,
          makerTraits: order.makerTraits
        },
        signature.r,
        signature.vs,
        orderData.amount ? ethers.BigNumber.from(orderData.amount) : order.makingAmount,
        ethers.BigNumber.from(orderData.takerTraits || '0'),
        txOptions
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      
      // Prepare response
      const response = {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        orderHash: getOrderHash(order)
      };
      
      // Include Monero-specific data if this was a Monero swap
      if (orderData.isMoneroSwap && swapSecrets) {
        response.swapSecrets = {
          claimSecret: swapSecrets.claimSecret,
          claimSecretHash: swapSecrets.claimSecretHash,
          refundSecret: swapSecrets.refundSecret,
          refundSecretHash: swapSecrets.refundSecretHash
        };
        response.moneroData = {
          xmrAddress: orderData.xmrAddress || '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A'
        };
      }
      
      return response;
    } catch (error) {
      console.error('Transaction failed:', error);
      return {
        success: false,
        error: error.toString(),
        reason: error.reason || 'unknown error'
      };
    }
  } catch (error) {
    console.error('Error in placeOrder:', error);
    throw error;
  }
}

module.exports = {
  placeOrder,
  signOrder,
  getOrderHash,
  generateSwapSecrets,
  encodeMoneroData
};
