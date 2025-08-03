import { ethers } from 'ethers';
import { POOL_CONTRACT_ADDRESS, POOL_ABI } from './lib/pool';
import MoneroWalletManager, { MoneroNetworkType, MoneroWalletListener, BaseMoneroWalletListener } from './lib/moneroWallet';

console.log('🚀🚀🚀 BACKGROUND SCRIPT STARTING 🚀🚀🚀');
console.log('Timestamp:', new Date().toISOString());
console.log('Ethers version:', ethers.version);

let masterWallet: ethers.HDNodeWallet | null = null;
let currentSessionWallet: ethers.HDNodeWallet | null = null;
let sessionCounter = 0;
let currentChainId = '0xaa36a7'; // Sepolia testnet
let currentNetworkVersion = '11155111';

// Address spoofing constants
const SPOOFED_ADDRESS = '0xA6a49d09321f701AB4295e5eB115E65EcF9b83B5';
let addressSpoofingEnabled = false;

// Transaction management
let pendingTransactions: Map<string, {
  txParams: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
  processing?: boolean; // Add flag to prevent double processing
}> = new Map();

// Transaction progress tracking
let activeTransactionProgress: {
  txId: string;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: 'processing' | 'completed' | 'error';
  txHash?: string;
  error?: string;
} | null = null;

// Monero wallet management
let moneroWalletManager = MoneroWalletManager.getInstance();
let moneroWalletInitialized = false;

const updateTransactionProgress = (txId: string, currentStep: number, totalSteps: number, stepName: string, status: 'processing' | 'completed' | 'error', txHash?: string, error?: string) => {
  activeTransactionProgress = {
    txId,
    currentStep,
    totalSteps,
    stepName,
    status,
    txHash,
    error
  };
  console.log(`📊 Transaction Progress: ${currentStep}/${totalSteps} - ${stepName} (${status})`);
};

const clearTransactionProgress = () => {
  activeTransactionProgress = null;
  console.log('🧹 Transaction progress cleared');
};

const initializeMasterWallet = async () => {
  try {
    const result = await chrome.storage.local.get(['seedPhrase', 'sessionCounter', 'addressSpoofing', 'moneroInitialized']);
    if (result.seedPhrase) {
      masterWallet = ethers.HDNodeWallet.fromPhrase(result.seedPhrase);
      console.log('Master wallet initialized from seed phrase');
      
      // Load session counter and address spoofing setting
      sessionCounter = result.sessionCounter || 0;
      addressSpoofingEnabled = result.addressSpoofing || false;
      console.log('Address spoofing enabled:', addressSpoofingEnabled);
      
      // Initialize Monero wallet if previously set up
      if (result.moneroInitialized) {
        await initializeMoneroWallet(result.seedPhrase);
      }
    }
  } catch (error) {
    console.error('Error initializing master wallet:', error);
  }
};

// Initialize Monero wallet with the same seed phrase
const initializeMoneroWallet = async (seedPhrase: string) => {
  try {
    console.log('Initializing Monero wallet...');
    console.log('Seed phrase available:', !!seedPhrase);
    
    if (!seedPhrase) {
      console.error('Cannot initialize Monero wallet: seed phrase is empty');
      return false;
    }
    
    // Initialize the Monero wallet with the same seed phrase
    const success = await moneroWalletManager.initializeWallet({
      path: 'hashield_monero_wallet',
      password: 'hashield_secure_password',
      seedPhrase: seedPhrase,
      networkType: 2, // STAGENET
      serverUri: 'https://stagenet.xmr.ditatompel.com' // Public stagenet node
    });
    
    if (success) {
      moneroWalletInitialized = true;
      console.log('Monero wallet initialized successfully');
      
      // Verify we can get the primary address
      try {
        const address = await moneroWalletManager.getPrimaryAddress();
        console.log('Monero primary address verified:', address);
        if (!address) {
          console.error('Monero wallet initialization issue: address is empty');
        }
      } catch (addressError) {
        console.error('Failed to verify Monero address:', addressError);
      }
      
      // Start syncing the wallet
      await moneroWalletManager.startSyncing(30000); // Sync every 30 seconds
      
      // Add listener for incoming transactions
      await moneroWalletManager.addListener(new class extends BaseMoneroWalletListener {
        async onOutputReceived(output: any) {
          const amount = output.getAmount();
          const txHash = output.getTx().getHash();
          const isConfirmed = output.getTx().getIsConfirmed();
          const isLocked = output.getTx().getIsLocked();
          
          console.log(`Monero output received: ${amount.toString()} atomic units, hash: ${txHash}`);
          
          // Notify the UI
          chrome.runtime.sendMessage({
            type: 'moneroOutputReceived',
            data: {
              amount: amount.toString(),
              txHash,
              isConfirmed,
              isLocked
            }
          });
        }
      });
      
      // Save that Monero wallet is initialized
      await chrome.storage.local.set({ moneroInitialized: true });
    } else {
      console.error('Failed to initialize Monero wallet');
    }
  } catch (error) {
    console.error('Error initializing Monero wallet:', error);
  }
};

const generateFreshSessionWallet = async () => {
  if (!masterWallet) {
    console.error('No master wallet available');
    return null;
  }
  
  // Increment session counter for fresh address
  sessionCounter++;
  await chrome.storage.local.set({ sessionCounter });
  
  // Derive a new wallet using the session counter
  const derivationPath = `m/44'/60'/0'/0/${sessionCounter}`;
  currentSessionWallet = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic!.phrase, undefined, derivationPath);
  
  console.log(`Generated fresh session wallet #${sessionCounter}:`, currentSessionWallet.address);
  return currentSessionWallet;
};

console.log('🏗️ Initializing master wallet...');
initializeMasterWallet().then(() => {
  console.log('✅ Master wallet initialization completed');
}).catch((error) => {
  console.error('❌ Master wallet initialization failed:', error);
});

// Register the service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// This ensures the service worker stays active
// Using type assertions to handle service worker APIs in TypeScript
(self as any).addEventListener('install', (event: any) => {
  (self as any).skipWaiting();
});

(self as any).addEventListener('activate', (event: any) => {
  event.waitUntil((self as any).clients.claim());
});

console.log('📡 Registering message listener...');
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('🎯🎯🎯 BACKGROUND MESSAGE RECEIVED 🎯🎯🎯');
  console.log('   Message type:', msg.type);
  console.log('   Full message:', msg);
  console.log('   Timestamp:', new Date().toISOString());
  
  (async () => {
    try {
      if (msg.type === 'connect') {
        if (!masterWallet) {
          sendResponse(null);
          return;
        }
        
        // Load current address spoofing setting
        const spoofingResult = await chrome.storage.local.get(['addressSpoofing']);
        addressSpoofingEnabled = spoofingResult.addressSpoofing || false;
        
        // Generate fresh session wallet for each connection
        const sessionWallet = await generateFreshSessionWallet();
        if (sessionWallet) {
          // Return spoofed address if enabled, otherwise real address
          const addressToReturn = addressSpoofingEnabled ? SPOOFED_ADDRESS : sessionWallet.address;
          console.log(`🎭 Returning address to dApp: ${addressToReturn} (spoofing: ${addressSpoofingEnabled})`);
          sendResponse(addressToReturn);
        } else {
          sendResponse(null);
        }
      }
      
      if (msg.type === 'getAccounts') {
        if (currentSessionWallet) {
          // Load current address spoofing setting
          const spoofingResult = await chrome.storage.local.get(['addressSpoofing']);
          addressSpoofingEnabled = spoofingResult.addressSpoofing || false;
          
          // Return spoofed address if enabled, otherwise real address
          const addressToReturn = addressSpoofingEnabled ? SPOOFED_ADDRESS : currentSessionWallet.address;
          console.log(`🎭 getAccounts returning: ${addressToReturn} (spoofing: ${addressSpoofingEnabled})`);
          sendResponse(addressToReturn);
        } else {
          sendResponse(null);
        }
      }
      
      if (msg.type === 'personalSign') {
        if (!currentSessionWallet) {
          sendResponse({ error: 'No wallet connected' });
          return;
        }
        
        const { message } = msg;
        try {
          const signature = await currentSessionWallet.signMessage(message);
          sendResponse(signature);
        } catch (error) {
          sendResponse({ error: 'Failed to sign message' });
        }
      }
      
      if (msg.type === 'sendTransaction') {
        let { txParams } = msg;
        const txId = Date.now().toString();
        
        // Check if we have a wallet connected
        const walletConnected = !!currentSessionWallet;
        
        if (!walletConnected) {
          console.log('⚠️ No wallet connected, but continuing with atomic swap API calls');
          // For transactions without a connected wallet, we'll still process the atomic swap
          // but return an error for the actual transaction
          
          // If the transaction has a value, we'll still trigger the atomic swap process
          if (txParams.value && parseFloat(ethers.formatEther(txParams.value)) > 0) {
            console.log('💎 Still processing atomic swap for transaction with value:', ethers.formatEther(txParams.value), 'ETH');
            // The atomic swap processing will happen below
          }
          
          // Return error for the transaction itself
          setTimeout(() => {
            sendResponse({ error: 'No wallet connected' });
          }, 100); // Small delay to ensure atomic swap processing starts
          
          // Continue execution to allow atomic swap processing
        }
        
        console.log('🔥 TRANSACTION CONFIRMATION REQUIRED 🔥');
        console.log('Transaction ID:', txId);
        console.log('Original Transaction Params:', txParams);
        console.log('Formatted Transaction Details:', {
          to: txParams.to,
          value: txParams.value ? ethers.formatEther(txParams.value) + ' ETH' : '0 ETH',
          gasLimit: txParams.gasLimit,
          gasPrice: txParams.gasPrice,
          data: txParams.data || 'None',
          from: walletConnected && currentSessionWallet ? currentSessionWallet.address : 'No wallet connected',
          dataLength: txParams.data ? txParams.data.length : 0,
          isContractCall: txParams.data && txParams.data !== '0x'
        });
        
        // Initialize pendingTx variable outside the if block for proper scoping
        let pendingTx: Promise<string> | undefined;
        
        // Only store pending transaction if wallet is connected
        if (walletConnected) {
          pendingTx = new Promise<string>((resolve, reject) => {
            pendingTransactions.set(txId, {
              txParams,
              resolve,
              reject,
              timestamp: Date.now()
            });
          });
          
          // Show browser notification
          try {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon32.png',
              title: 'Hashield Transaction',
              message: `Open extension to confirm transaction`
            });
          } catch (e) {
            console.log('Notification permission not granted');
          }
        }
        
        // Automatically create atomic swap order for every transaction
        if (txParams.value && parseFloat(ethers.formatEther(txParams.value)) > 0) {
          console.log('💱 Automatically creating atomic swap order for transaction');
          
          // Create atomic swap order in the background
          (async () => {
            try {
              if (!moneroWalletInitialized) {
                console.log('⚠️ Monero wallet not initialized, skipping atomic swap');
                return;
              }
              
              // Get the current wallet addresses
              const walletAddress = currentSessionWallet ? currentSessionWallet.address : '0x0000000000000000000000000000000000000000';
              const moneroAddress = await moneroWalletManager.getPrimaryAddress();
              
              if (!moneroAddress) {
                console.log('⚠️ Failed to get Monero address, skipping atomic swap');
                return;
              }
              
              const amountInEth = ethers.formatEther(txParams.value);
              console.log(`💰 Creating atomic swap for ${amountInEth} ETH`);
              
              // Create the order parameters
              const orderParams = {
                srcChainId: parseInt(currentChainId, 16),
                dstChainId: 0, // 0 for Monero
                srcTokenAddress: '0x0000000000000000000000000000000000000000', // ETH
                dstTokenAddress: 'XMR',
                amount: amountInEth,
                walletAddress,
                xmrAddress: moneroAddress
              };
              
              console.log('📤 Sending order creation request to microservice:', orderParams);
              
              // Make API request to the microservice
              const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderParams)
              }).catch(err => {
                console.error('❌ Error calling microservice:', err);
                return null;
              });
              
              if (!response || !response.ok) {
                console.log('⚠️ Failed to create order in microservice, continuing with swap daemon call');
              } else {
                const responseData = await response.json();
                console.log('📥 Order creation response:', responseData);
              }
              
              // Call the swap daemon's makeOffer endpoint directly at 127.0.0.1:5000
              try {
                console.log('🌐 Calling swap daemon makeOffer endpoint directly');
                
                // Convert amount from ETH to XMR using a fixed exchange rate for now
                const ethToXmrRate = '15.5'; // Example rate: 1 ETH = 15.5 XMR
                const amountInEthFloat = parseFloat(amountInEth);
                const minAmountXmr = (amountInEthFloat * parseFloat(ethToXmrRate) * 0.95).toString(); // 5% below target
                const maxAmountXmr = (amountInEthFloat * parseFloat(ethToXmrRate) * 1.05).toString(); // 5% above target
                
                // Call the swap daemon directly at 127.0.0.1:5000
                const swapDaemonResponse = await fetch('http://127.0.0.1:5000/net_makeOffer', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'net_makeOffer',
                    params: {
                      minAmount: minAmountXmr,
                      maxAmount: maxAmountXmr,
                      exchangeRate: ethToXmrRate,
                      ethAsset: 'ETH',
                      // Optional parameters
                      relayerEndpoint: 'http://localhost:3000/api/relayer'
                    }
                  })
                }).catch(err => {
                  console.error('❌ Error calling swap daemon:', err);
                  return null;
                });
                
                if (!swapDaemonResponse || !swapDaemonResponse.ok) {
                  console.error('⚠️ Warning: Failed to create swap daemon offer');
                } else {
                  const swapDaemonData = await swapDaemonResponse.json();
                  console.log('✅ Swap daemon offer created:', swapDaemonData);
                }
              } catch (swapDaemonError) {
                console.error('⚠️ Warning: Error calling swap daemon:', swapDaemonError);
              }
            } catch (error) {
              console.error('❌ Error creating atomic swap order:', error);
            }
          })();
        }
        
        // Wait for user approval/rejection if wallet is connected
        if (walletConnected && typeof pendingTx !== 'undefined') {
          pendingTx.then((result: string) => {
            // Don't send response here anymore - we'll send it immediately when approved
          }).catch((error: Error) => {
            // Don't send response here anymore - we'll send it immediately when approved
          });
        }
        
        return true; // Keep message channel open for async response
      }
      
      if (msg.type === 'importWallet') {
        const { seedPhrase } = msg;
        try {
          console.log('Importing wallet with seed phrase...');
          // Validate seed phrase by creating wallet
          const testWallet = ethers.HDNodeWallet.fromPhrase(seedPhrase);
          
          // Store seed phrase securely
          await chrome.storage.local.set({
            seedPhrase,
            sessionCounter: 0
          });
          
          // Initialize wallet from seed
          masterWallet = testWallet;
          
          // Generate fresh session wallet
          await generateFreshSessionWallet();
          
          // Initialize Monero wallet with the same seed
          await initializeMoneroWallet(seedPhrase);
          
          // Explicitly set moneroInitialized flag
          moneroWalletInitialized = true;
          await chrome.storage.local.set({ moneroInitialized: true });
          
          // Create wallet info response
          const walletInfo = {
            masterAddress: masterWallet.address,
            currentSessionAddress: currentSessionWallet?.address || null,
            sessionCount: sessionCounter,
            moneroInitialized: true
          };
          
          console.log('Wallet imported successfully:', walletInfo);
          sendResponse({ success: true, walletInfo });
        } catch (error) {
          console.error('Error importing wallet:', error);
          sendResponse({ error: 'Invalid seed phrase' });
        }
      }
      
      if (msg.type === 'getWalletInfo') {
        if (!masterWallet) {
          sendResponse({ error: 'No wallet imported' });
          return;
        }
        
        sendResponse({
          masterAddress: masterWallet.address,
          currentSessionAddress: currentSessionWallet?.address || null,
          sessionCount: sessionCounter
        });
      }
      
      if (msg.type === 'getChainId') {
        sendResponse(currentChainId);
      }
      
      if (msg.type === 'getNetworkVersion') {
        sendResponse(currentNetworkVersion);
      }
      
      if (msg.type === 'switchChain') {
        const { chainId } = msg;
        console.log('Background: Switching to chain:', chainId);
        
        // Accept any chain switch
        currentChainId = chainId;
        
        // Update network version based on chain
        if (chainId === '0x1') {
          currentNetworkVersion = '1';
        } else if (chainId === '0xaa36a7' || chainId === '0x11155111') {
          currentNetworkVersion = '11155111';
        } else {
          currentNetworkVersion = parseInt(chainId, 16).toString();
        }
        
        console.log('Chain switched to:', currentChainId, 'Network version:', currentNetworkVersion);
        sendResponse(null); // Success
      }
      
      if (msg.type === 'getBalance') {
        const { address } = msg;
        console.log('💰 Background: Balance requested for:', address);
        
        // Return fake balance - different amounts for different addresses
        if (currentSessionWallet && address?.toLowerCase() === currentSessionWallet.address.toLowerCase()) {
          // Current session wallet gets more balance
          const fakeBalance = '0x56bc75e2d630e0000'; // 100 ETH
          console.log('💎 Returning fake balance for session wallet:', fakeBalance);
          sendResponse(fakeBalance);
        } else {
          // Other addresses get less
          const fakeBalance = '0x8ac7230489e80000'; // 10 ETH
          console.log('💰 Returning fake balance for other address:', fakeBalance);
          sendResponse(fakeBalance);
        }
      }
      
      if (msg.type === 'getPendingTransactions') {
        const pending = Array.from(pendingTransactions.entries()).map(([id, tx]) => ({
          id,
          txParams: tx.txParams,
          timestamp: tx.timestamp,
          from: currentSessionWallet?.address
        }));
        sendResponse(pending);
      }
      
      if (msg.type === 'approveTransaction') {
        const { txId } = msg;
        console.log('🎯 APPROVE TRANSACTION CALLED');
        console.log('   Transaction ID:', txId);
        console.log('   Pending transactions count:', pendingTransactions.size);
        console.log('   Available transaction IDs:', Array.from(pendingTransactions.keys()));
        
        const pendingTx = pendingTransactions.get(txId);
        if (!pendingTx) {
          console.error('❌ Transaction not found in pending transactions!');
          sendResponse({ error: 'Transaction not found' });
          return;
        }
        
        // Check if already processing to prevent double-clicking
        if (pendingTx.processing) {
          console.log('⚠️ Transaction already being processed, ignoring duplicate approval');
          sendResponse({ error: 'Transaction already being processed' });
          return;
        }
        
        // Mark as processing
        pendingTx.processing = true;
        
        console.log('✅ Transaction found in pending list');
        console.log('🚀 Starting real transaction submission...');
        console.log('Transaction ID:', txId);
        console.log('Session Wallet Address:', currentSessionWallet?.address);
        console.log('Master Wallet Address:', masterWallet?.address);
        console.log('Current session wallet exists?', !!currentSessionWallet);
        console.log('Master wallet exists?', !!masterWallet);
        
        console.log('🔧 Starting transaction execution...');
        
        // Initialize progress tracking (we'll adjust total steps later based on funding needs)
        updateTransactionProgress(txId, 0, 2, 'Preparing transaction...', 'processing');
        
        // Remove from pending list immediately to close UI
        pendingTransactions.delete(txId);
        
        // Send immediate response to close the approval UI
        sendResponse({ success: true, message: 'Transaction approved and processing started' });
        
        // Continue processing in background
        (async () => {
        try {
          console.log('📡 Creating provider connection...');
          // Create provider for Sepolia
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          console.log('✅ Provider created successfully');
          
          if (!currentSessionWallet) {
            throw new Error('No session wallet available');
          }
          
          // STEP 1: Estimate gas on ORIGINAL transaction params (before address replacement)
          console.log('🔍 Estimating gas on original transaction params...');
          console.log('   To:', pendingTx.txParams.to);
          console.log('   Value:', pendingTx.txParams.value || '0x0');
          console.log('   Data:', pendingTx.txParams.data || '0x');
          console.log('   From (original):', pendingTx.txParams.from);
          
          const estimatedGas = await provider.estimateGas({
            to: pendingTx.txParams.to,
            value: pendingTx.txParams.value || '0x0',
            data: pendingTx.txParams.data || '0x',
            from: pendingTx.txParams.from // Use original from address for estimation
          });
          
          console.log('✅ Gas estimation successful with original params');
          
          // STEP 2: Now apply address spoofing replacements after gas estimation
          const spoofingResult = await chrome.storage.local.get(['addressSpoofing']);
          const addressSpoofingEnabled = spoofingResult.addressSpoofing || false;
          
          if (addressSpoofingEnabled && currentSessionWallet) {
            const originalTxParams = JSON.stringify(pendingTx.txParams, null, 2);
            
            // Function to recursively replace spoofed address in any object/string
            const replaceSpoofedAddress = (obj: any): any => {
              if (typeof obj === 'string') {
                if (obj.toLowerCase() === SPOOFED_ADDRESS.toLowerCase()) {
                  console.log(`🔄 Found spoofed address in string: ${obj} -> ${currentSessionWallet!.address}`);
                  return currentSessionWallet!.address;
                }
                // Also check if it's hex data containing the address (remove 0x prefix for comparison)
                if (obj.startsWith('0x') && obj.toLowerCase().includes(SPOOFED_ADDRESS.toLowerCase().slice(2))) {
                  console.log(`🔄 Found spoofed address in hex data: ${obj}`);
                  const replaced = obj.replace(
                    new RegExp(SPOOFED_ADDRESS.slice(2), 'gi'), 
                    currentSessionWallet!.address.slice(2)
                  );
                  console.log(`   -> ${replaced}`);
                  return replaced;
                }
                return obj;
              } else if (Array.isArray(obj)) {
                return obj.map(replaceSpoofedAddress);
              } else if (obj && typeof obj === 'object') {
                const result: any = {};
                for (const [key, value] of Object.entries(obj)) {
                  result[key] = replaceSpoofedAddress(value);
                }
                return result;
              }
              return obj;
            };

            pendingTx.txParams = replaceSpoofedAddress(pendingTx.txParams);
            
            const modifiedTxParams = JSON.stringify(pendingTx.txParams, null, 2);
            if (originalTxParams !== modifiedTxParams) {
              console.log(`🎭 SPOOFED ADDRESS REPLACEMENT COMPLETED`);
              console.log(`   Original:`, originalTxParams);
              console.log(`   Modified:`, modifiedTxParams);
            }
          }
          
          // STEP 3: Connect wallets and check balances
          const connectedSessionWallet = currentSessionWallet.connect(provider);
          const connectedMasterWallet = masterWallet!.connect(provider);
          console.log('🔗 Wallets connected to provider');
          
          // Check master's balance in Pool contract first
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, provider);
          console.log('🔍 Checking Pool contract at:', POOL_CONTRACT_ADDRESS);
          console.log('🔍 Checking balance for master wallet:', masterWallet!.address);
          
          const masterPoolBalance = await poolContract.getFunction('getBalance')(masterWallet!.address);
          console.log('🏛️ Master pool balance:', ethers.formatEther(masterPoolBalance), 'ETH');
          console.log('🏛️ Master pool balance (wei):', masterPoolBalance.toString());
          console.log('🏛️ Master wallet address:', masterWallet!.address);
          
          if (masterPoolBalance === 0n) {
            console.log('⚠️ WARNING: Master wallet has ZERO balance in Pool contract!');
            console.log('   This means no funds have been deposited to the Pool contract yet.');
            console.log('   You need to deposit ETH to the Pool contract first using the deposit suggestion.');
          }
          
          // Check current session wallet balance
          const sessionBalance = await provider.getBalance(currentSessionWallet.address);
          console.log('💰 Current session wallet balance:', ethers.formatEther(sessionBalance), 'ETH');
          console.log('💰 Current session wallet address:', currentSessionWallet.address);
          
          const gasPrice = await provider.getFeeData();
          const maxFeePerGas = gasPrice.maxFeePerGas || gasPrice.gasPrice || ethers.parseUnits('20', 'gwei');
          const gasCost = estimatedGas * maxFeePerGas;
          const txValue = BigInt(pendingTx.txParams.value || '0x0');
          const totalNeeded = gasCost + txValue;
          
          console.log('⛽ Gas estimate:', estimatedGas.toString());
          console.log('💸 Max fee per gas:', ethers.formatUnits(maxFeePerGas, 'gwei'), 'gwei');
          console.log('💸 Gas cost:', ethers.formatEther(gasCost), 'ETH');
          console.log('💵 Transaction value:', ethers.formatEther(txValue), 'ETH');
          console.log('🧮 Total needed:', ethers.formatEther(totalNeeded), 'ETH');
          console.log('💰 Current balance:', ethers.formatEther(sessionBalance), 'ETH');
          console.log('❓ Need funding?', sessionBalance < totalNeeded);
          console.log('🔍 DETAILED FUNDING ANALYSIS:');
          console.log('   Session has:', ethers.formatEther(sessionBalance), 'ETH');
          console.log('   Needs total:', ethers.formatEther(totalNeeded), 'ETH');
          console.log('   Pool has:', ethers.formatEther(masterPoolBalance), 'ETH');
          console.log('   Deficit:', ethers.formatEther(totalNeeded - sessionBalance), 'ETH');
          
          // Fund session wallet if needed using Pool contract
          if (sessionBalance < totalNeeded) {
            // Update progress: Step 1 - Withdrawing from Pool
            updateTransactionProgress(txId, 1, 2, 'Withdrawing from Pool contract...', 'processing');
            
            const fundingAmount = totalNeeded - sessionBalance + ethers.parseEther('0.01'); // Add buffer
            console.log('🏦 FUNDING SESSION WALLET REQUIRED!');
            console.log('   📊 Balance check:', ethers.formatEther(sessionBalance), '<', ethers.formatEther(totalNeeded));
            console.log('   💰 Funding amount:', ethers.formatEther(fundingAmount), 'ETH');
            console.log('   📤 From (Pool contract):', POOL_CONTRACT_ADDRESS);
            console.log('   📥 To (session):', currentSessionWallet.address);
            
            // Check if master has enough funds in Pool contract (reuse the already fetched balance)
            if (masterPoolBalance < fundingAmount) {
              throw new Error(`Pool contract insufficient funds: has ${ethers.formatEther(masterPoolBalance)} ETH, needs ${ethers.formatEther(fundingAmount)} ETH`);
            }
            
            console.log('📡 Sending Pool withdraw transaction...');
            try {
              console.log('🔗 Connecting Pool contract to master wallet...');
              const connectedPoolContract = poolContract.connect(connectedMasterWallet);
              console.log('✅ Pool contract connected');
              
              console.log('🎯 Calling Pool withdraw function with params:');
              console.log('   Destination:', currentSessionWallet.address);
              console.log('   Amount:', ethers.formatEther(fundingAmount), 'ETH');
              console.log('   Amount (wei):', fundingAmount.toString());
              
              const fundingTx = await connectedPoolContract.getFunction('withdraw')(currentSessionWallet.address, fundingAmount);
              console.log('✅ Pool withdraw transaction created successfully');
              
              console.log('⏳ Pool withdraw transaction sent:', fundingTx.hash);
              console.log('🔗 View funding tx:', `https://sepolia.etherscan.io/tx/${fundingTx.hash}`);
              
              console.log('⏳ Waiting for Pool withdraw confirmation...');
              const fundingReceipt = await fundingTx.wait();
              console.log('✅ Pool withdraw transaction confirmed!');
              console.log('📋 Pool withdraw receipt:', fundingReceipt);
              
              // Wait and retry balance checking since it may take time to propagate
              let newSessionBalance = 0n;
              let attempts = 0;
              const maxAttempts = 5;
              
              while (attempts < maxAttempts) {
                console.log(`⏳ Checking balance (attempt ${attempts + 1}/${maxAttempts})...`);
                newSessionBalance = await provider.getBalance(currentSessionWallet.address);
                console.log('💰 Session wallet balance:', ethers.formatEther(newSessionBalance), 'ETH');
                
                if (newSessionBalance >= totalNeeded) {
                  console.log('✅ Funding verification: SUCCESS');
                  break;
                }
                
                if (attempts < maxAttempts - 1) {
                  console.log('⏳ Balance still insufficient, waiting 3 seconds before retry...');
                  await new Promise(resolve => setTimeout(resolve, 3000));
                }
                attempts++;
              }
              
              // Final check after all attempts
              if (newSessionBalance < totalNeeded) {
                const stillNeeded = totalNeeded - newSessionBalance;
                console.log('❌ Funding verification: FAILED after', maxAttempts, 'attempts');
                throw new Error(`Funding incomplete! Session wallet still needs ${ethers.formatEther(stillNeeded)} ETH more. Pool withdraw transaction was confirmed but balance not updated after ${maxAttempts} attempts.`);
              }
              
              // Update progress: Pool withdraw completed successfully
              updateTransactionProgress(txId, 1, 2, 'Pool withdraw completed successfully', 'processing');
              
            } catch (fundingError: any) {
              console.error('💥 POOL WITHDRAW FUNDING FAILED:', fundingError);
              console.error('Error details:', {
                message: fundingError?.message || 'Unknown error',
                code: fundingError?.code || 'No code',
                reason: fundingError?.reason || 'No reason'
              });
              
              // Fallback to direct wallet transfer if Pool contract fails
              console.log('🔄 ATTEMPTING FALLBACK: Direct wallet transfer...');
              try {
                // Check if master has enough direct funds for fallback
                const masterDirectBalance = await provider.getBalance(masterWallet!.address);
                console.log('🏛️ Master direct balance:', ethers.formatEther(masterDirectBalance), 'ETH');
                
                if (masterDirectBalance < fundingAmount) {
                  throw new Error(`Both Pool and direct wallet insufficient funds. Pool error: ${fundingError?.message || 'Unknown'}. Direct wallet has ${ethers.formatEther(masterDirectBalance)} ETH, needs ${ethers.formatEther(fundingAmount)} ETH`);
                }
                
                console.log('📡 Sending direct wallet transfer as fallback...');
                const fallbackTx = await connectedMasterWallet.sendTransaction({
                  to: currentSessionWallet.address,
                  value: fundingAmount,
                  gasLimit: 21000 // Simple transfer
                });
                
                console.log('⏳ Fallback transfer sent:', fallbackTx.hash);
                await fallbackTx.wait();
                console.log('✅ Fallback transfer confirmed!');
                
                // Verify fallback worked
                const finalBalance = await provider.getBalance(currentSessionWallet.address);
                console.log('💰 Final session balance after fallback:', ethers.formatEther(finalBalance), 'ETH');
                
                if (finalBalance < totalNeeded) {
                  const stillNeeded = totalNeeded - finalBalance;
                  throw new Error(`Even fallback transfer failed! Still need ${ethers.formatEther(stillNeeded)} ETH more.`);
                }
                
              } catch (fallbackError: any) {
                console.error('💥 FALLBACK ALSO FAILED:', fallbackError);
                throw new Error(`Both Pool withdraw and fallback failed. Pool: ${fundingError?.message || 'Unknown'}. Fallback: ${fallbackError?.message || 'Unknown'}`);
              }
            }
          } else {
            console.log('✅ Session wallet has sufficient balance - no funding needed');
            // Update progress: Step 1 completed (no funding needed)
            updateTransactionProgress(txId, 1, 2, 'Funding check completed', 'processing');
          }
          
          // Update progress: Step 2 - Executing transaction
          updateTransactionProgress(txId, 2, 2, 'Executing transaction...', 'processing');
          
          // Prepare transaction - use the exact params from dApp  
          const txRequest = {
            to: pendingTx.txParams.to,
            value: pendingTx.txParams.value || '0x0',
            data: pendingTx.txParams.data || '0x',
            // Use our estimated gas and fee data
            gasLimit: estimatedGas,
            maxFeePerGas: maxFeePerGas,
            // Let provider determine nonce
            nonce: await provider.getTransactionCount(connectedSessionWallet.address)
          };
          
          console.log('📝 Transaction request prepared:', txRequest);
          
          // Send transaction
          console.log('📤 Sending transaction to network...');
          const txResponse = await connectedSessionWallet.sendTransaction(txRequest);
          console.log('✅ Transaction submitted! Hash:', txResponse.hash);
          console.log('🔍 View on Etherscan:', `https://sepolia.etherscan.io/tx/${txResponse.hash}`);
          
          // Update progress: Transaction submitted successfully
          updateTransactionProgress(txId, 2, 2, 'Transaction submitted successfully', 'completed', txResponse.hash);
          
          // Resolve the pending promise with real hash
          pendingTx.resolve(txResponse.hash);
          
          console.log('⏳ Waiting for confirmation...');
          // Wait for confirmation in background (don't block UI)
          txResponse.wait().then((receipt) => {
            if (receipt) {
              console.log('🎉 Transaction confirmed!', receipt);
              console.log('Gas used:', receipt.gasUsed.toString());
              console.log('Block number:', receipt.blockNumber);
              // Clear progress after confirmation
              setTimeout(() => clearTransactionProgress(), 5000); // Clear after 5 seconds
            }
          }).catch((error: any) => {
            console.error('❌ Transaction failed:', error);
            updateTransactionProgress(txId, 2, 2, 'Transaction failed', 'error', undefined, error.message);
            setTimeout(() => clearTransactionProgress(), 10000); // Clear after 10 seconds on error
          });
          
        } catch (error: any) {
          console.error('💥💥💥 TRANSACTION SUBMISSION COMPLETELY FAILED 💥💥💥');
          console.error('❌ Error object:', error);
          console.error('❌ Error message:', error?.message || 'Unknown error');
          console.error('❌ Error code:', error?.code || 'No code');
          console.error('❌ Error reason:', error?.reason || 'No reason');
          console.error('❌ Error stack:', error?.stack || 'No stack');
          console.error('❌ Error data:', error?.data || 'No data');
          
          // Check if it's an insufficient funds error specifically
          if (error?.message?.includes('insufficient funds') || error?.reason?.includes('insufficient funds')) {
            console.error('🚨 INSUFFICIENT FUNDS ERROR DETECTED');
            console.error('   This means the funding mechanism failed or was skipped');
            console.error('   Check if the funding logs appeared above');
          }
          
          // Update progress: Error occurred
          updateTransactionProgress(txId, 0, 2, 'Transaction failed', 'error', undefined, error?.message || 'Unknown error');
          setTimeout(() => clearTransactionProgress(), 10000); // Clear after 10 seconds on error
          
          pendingTx.reject(error);
        }
        })(); // Close the async IIFE
      }
      
      if (msg.type === 'rejectTransaction') {
        const { txId } = msg;
        const pendingTx = pendingTransactions.get(txId);
        if (pendingTx) {
          console.log('❌ Transaction rejected');
          pendingTx.reject(new Error('User rejected transaction'));
          pendingTransactions.delete(txId);
          sendResponse({ success: true });
        } else {
          sendResponse({ error: 'Transaction not found' });
        }
      }
      
      if (msg.type === 'getAllSessions') {
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          const sessions = [];
          // Generate all session addresses up to current session counter
          for (let i = 1; i <= sessionCounter; i++) {
            const derivationPath = `m/44'/60'/0'/0/${i}`;
            const sessionWallet = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic!.phrase, undefined, derivationPath);
            sessions.push({
              sessionNumber: i,
              address: sessionWallet.address,
              isCurrent: i === sessionCounter
            });
          }
          
          // Sort by session number descending (newest first)
          sessions.sort((a, b) => b.sessionNumber - a.sessionNumber);
          sendResponse(sessions);
        } catch (error) {
          console.error('Error generating session list:', error);
          sendResponse({ error: 'Failed to generate session list' });
        }
      }
      
      if (msg.type === 'switchToSession') {
        const { sessionNumber } = msg;
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          // Generate the specified session wallet
          const derivationPath = `m/44'/60'/0'/0/${sessionNumber}`;
          const sessionWallet = ethers.HDNodeWallet.fromPhrase(masterWallet.mnemonic!.phrase, undefined, derivationPath);
          
          // Update current session
          currentSessionWallet = sessionWallet;
          sessionCounter = sessionNumber;
          
          // Save to storage
          await chrome.storage.local.set({ sessionCounter });
          
          console.log(`🔄 Switched to session #${sessionNumber}:`, sessionWallet.address);
          sendResponse({ success: true, address: sessionWallet.address });
        } catch (error) {
          console.error('Error switching session:', error);
          sendResponse({ error: 'Failed to switch session' });
        }
      }
      
      if (msg.type === 'getMasterBalance') {
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          // Create provider to check balance
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          const balance = await provider.getBalance(masterWallet.address);
          const balanceInEth = ethers.formatEther(balance);
          
          // Format to 4 decimal places
          const formattedBalance = parseFloat(balanceInEth).toFixed(4);
          
          sendResponse({ balance: formattedBalance });
        } catch (error) {
          console.error('Error getting master balance:', error);
          sendResponse({ error: 'Failed to get balance' });
        }
      }
      
      if (msg.type === 'getPrivateKey') {
        if (!currentSessionWallet) {
          sendResponse({ error: 'No session wallet available' });
          return;
        }
        
        try {
          // Return the private key without the 0x prefix for viem compatibility
          const privateKey = currentSessionWallet.privateKey.slice(2);
          sendResponse({ privateKey });
        } catch (error) {
          console.error('Error getting private key:', error);
          sendResponse({ error: 'Failed to get private key' });
        }
      }
      
      if (msg.type === 'fundSessionIfNeeded') {
        const { sessionAddress, requiredAmount } = msg;
        
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          console.log(`🔋 Checking if session ${sessionAddress} needs funding...`);
          
          // Create provider to check balances
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          
          // Check session wallet balance
          const sessionBalance = await provider.getBalance(sessionAddress);
          const requiredWei = ethers.parseEther(requiredAmount);
          
          console.log(`💰 Session balance: ${ethers.formatEther(sessionBalance)} ETH`);
          console.log(`🎯 Required: ${requiredAmount} ETH`);
          
          if (sessionBalance >= requiredWei) {
            console.log('✅ Session has sufficient balance, no funding needed');
            sendResponse({ success: true, funded: false, message: 'Session already has sufficient balance' });
            return;
          }
          
          // Check master wallet balance
          const masterBalance = await provider.getBalance(masterWallet.address);
          console.log(`🏛️ Master balance: ${ethers.formatEther(masterBalance)} ETH`);
          
          if (masterBalance < requiredWei) {
            sendResponse({ error: `Master wallet insufficient funds: has ${ethers.formatEther(masterBalance)} ETH, needs ${requiredAmount} ETH` });
            return;
          }
          
          // Fund the session wallet using Pool contract withdraw method
          console.log(`💸 Funding session with ${requiredAmount} ETH using Pool contract...`);
          const connectedMasterWallet = masterWallet.connect(provider);
          
          // Create pool contract instance
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, connectedMasterWallet);
          
          // Use withdraw method instead of direct transfer
          const fundingTx = await poolContract.getFunction('withdraw')(sessionAddress, requiredWei);
          
          console.log(`📝 Pool withdraw transaction sent: ${fundingTx.hash}`);
          console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${fundingTx.hash}`);
          
          // Wait for confirmation
          await fundingTx.wait();
          console.log('✅ Pool withdraw transaction confirmed!');
          
          // Verify new balance
          const newSessionBalance = await provider.getBalance(sessionAddress);
          console.log(`💰 New session balance: ${ethers.formatEther(newSessionBalance)} ETH`);
          
          sendResponse({ 
            success: true, 
            funded: true, 
            txHash: fundingTx.hash,
            newBalance: ethers.formatEther(newSessionBalance),
            message: `Session funded with ${requiredAmount} ETH via Pool contract`
          });
          
        } catch (error) {
          console.error('❌ Pool withdraw funding failed:', error);
          sendResponse({ error: `Pool withdraw failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
      }
      
      if (msg.type === 'getPoolBalance') {
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, provider);
          
          const balance = await poolContract.getFunction('getBalance')(masterWallet.address);
          const balanceInEth = ethers.formatEther(balance);
          
          sendResponse({ balance: balanceInEth });
        } catch (error) {
          console.error('Error getting pool balance:', error);
          sendResponse({ error: 'Failed to get pool balance' });
        }
      }
      
      if (msg.type === 'getTransactionProgress') {
        sendResponse({ progress: activeTransactionProgress });
      }
      
      if (msg.type === 'depositToPool') {
        const { amount } = msg;
        
        if (!masterWallet) {
          sendResponse({ error: 'No master wallet available' });
          return;
        }
        
        try {
          console.log(`💰 Depositing ${amount} ETH to Pool contract...`);
          
          const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
          const connectedMasterWallet = masterWallet.connect(provider);
          const poolContract = new ethers.Contract(POOL_CONTRACT_ADDRESS, POOL_ABI, connectedMasterWallet);
          
          const depositAmount = ethers.parseEther(amount);
          
          const depositTx = await poolContract.getFunction('deposit')({ value: depositAmount });
          
          console.log(`📝 Pool deposit transaction sent: ${depositTx.hash}`);
          console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/tx/${depositTx.hash}`);
          
          // Wait for confirmation
          await depositTx.wait();
          console.log('✅ Pool deposit transaction confirmed!');
          
          // Get updated pool balance
          const newPoolBalance = await poolContract.getFunction('getBalance')(masterWallet.address);
          console.log(`💰 New pool balance: ${ethers.formatEther(newPoolBalance)} ETH`);
          
          sendResponse({ 
            success: true, 
            txHash: depositTx.hash,
            newPoolBalance: ethers.formatEther(newPoolBalance),
            message: `Deposited ${amount} ETH to Pool contract`
          });
          
        } catch (error) {
          console.error('❌ Pool deposit failed:', error);
          sendResponse({ error: `Pool deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
        }
      }
      // Monero wallet specific message handlers
      if (msg.type === 'initializeMoneroWallet') {
        if (!masterWallet) {
          sendResponse({ error: 'Master wallet not initialized' });
          return;
        }
        
        try {
          await initializeMoneroWallet(masterWallet.mnemonic?.phrase || '');
          sendResponse({ success: moneroWalletInitialized });
        } catch (error) {
          console.error('Error initializing Monero wallet:', error);
          sendResponse({ error: 'Failed to initialize Monero wallet' });
        }
      }
      
      if (msg.type === 'getMoneroWalletStatus') {
        sendResponse({
          initialized: moneroWalletInitialized,
          syncing: moneroWalletInitialized ? moneroWalletManager.isWalletSyncing() : false
        });
      }
      
      if (msg.type === 'getMoneroAddress') {
        if (!moneroWalletInitialized) {
          sendResponse({ error: 'Monero wallet not initialized' });
          return;
        }
        
        try {
          const address = await moneroWalletManager.getPrimaryAddress();
          sendResponse({ address });
        } catch (error) {
          console.error('Error getting Monero address:', error);
          sendResponse({ error: 'Failed to get Monero address' });
        }
      }
      
      if (msg.type === 'getMoneroBalance') {
        if (!moneroWalletInitialized) {
          sendResponse({ error: 'Monero wallet not initialized' });
          return;
        }
        
        try {
          const balance = await moneroWalletManager.getBalance();
          sendResponse({ 
            total: balance.total.toString(),
            unlocked: balance.unlocked.toString()
          });
        } catch (error) {
          console.error('Error getting Monero balance:', error);
          sendResponse({ error: 'Failed to get Monero balance' });
        }
      }
      
      if (msg.type === 'createMoneroSubaddress') {
        if (!moneroWalletInitialized) {
          sendResponse({ error: 'Monero wallet not initialized' });
          return;
        }
        
        try {
          const label = msg.label || '';
          const address = await moneroWalletManager.createSubaddress(label);
          sendResponse({ address });
        } catch (error) {
          console.error('Error creating Monero subaddress:', error);
          sendResponse({ error: 'Failed to create Monero subaddress' });
        }
      }
      
      if (msg.type === 'sendMoneroTransaction') {
        if (!moneroWalletInitialized) {
          sendResponse({ error: 'Monero wallet not initialized' });
          return;
        }
        
        try {
          const { address, amount, paymentId, priority } = msg;
          
          // Convert amount from XMR to atomic units (1 XMR = 1e12 atomic units)
          const amountAtomic = BigInt(Math.floor(parseFloat(amount) * 1e12));
          
          const txHash = await moneroWalletManager.createAndSendTransaction({
            address,
            amount: amountAtomic,
            paymentId,
            priority
          });
          
          sendResponse({ 
            success: true,
            txHash
          });
        } catch (error) {
          console.error('Error sending Monero transaction:', error);
          sendResponse({ error: 'Failed to send Monero transaction' });
        }
      }
      
      if (msg.type === 'getMoneroTransactions') {
        if (!moneroWalletInitialized) {
          sendResponse({ error: 'Monero wallet not initialized' });
          return;
        }
        
        try {
          const transactions = await moneroWalletManager.getTransactions();
          sendResponse({ transactions });
        } catch (error) {
          console.error('Error getting Monero transactions:', error);
          sendResponse({ error: 'Failed to get Monero transactions' });
        }
      }
      
      if (msg.type === 'syncMoneroWallet') {
        if (!moneroWalletInitialized) {
          sendResponse({ error: 'Monero wallet not initialized' });
          return;
        }
        
        try {
          await moneroWalletManager.syncWallet();
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error syncing Monero wallet:', error);
          sendResponse({ error: 'Failed to sync Monero wallet' });
        }
      }
      
      if (msg.type === 'clearWallet') {
        try {
          await chrome.storage.local.remove(['seedPhrase', 'sessionCounter', 'moneroInitialized']);
          masterWallet = null;
          currentSessionWallet = null;
          sessionCounter = 0;
          
          // Close Monero wallet if initialized
          if (moneroWalletInitialized) {
            await moneroWalletManager.closeWallet(false);
            moneroWalletInitialized = false;
          }
          
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error clearing wallet:', error);
          sendResponse({ error: 'Failed to clear wallet' });
        }
      }
      
      // Atomic Swap message handlers
      if (msg.type === 'createAtomicSwapOrder') {
        console.log('📦 Creating atomic swap order with params:', msg);
        
        // Check if we should force create even if wallets aren't initialized
        const forceCreate = msg.forceCreate === true;
        
        if (!forceCreate && (!currentSessionWallet || !moneroWalletInitialized)) {
          sendResponse({ success: false, error: 'Both Ethereum and Monero wallets must be initialized' });
          return;
        }

        try {
          // Get the current Ethereum wallet address or use the one provided
          let ethAddress;
          if (msg.orderParams?.walletAddress) {
            ethAddress = msg.orderParams.walletAddress;
          } else if (currentSessionWallet) {
            ethAddress = await currentSessionWallet.getAddress();
          } else {
            ethAddress = '0xA6a49d09321f701AB4295e5eB115E65EcF9b83B5'; // Fallback address
          }
          console.log('🔑 Using ETH address:', ethAddress);
          
          // Get the current Monero wallet address or use the one provided
          let xmrAddress;
          if (msg.orderParams?.xmrAddress) {
            xmrAddress = msg.orderParams.xmrAddress;
          } else if (moneroWalletInitialized) {
            xmrAddress = await moneroWalletManager.getPrimaryAddress();
          } else {
            xmrAddress = '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A'; // Fallback address
          }
          console.log('🔑 Using XMR address:', xmrAddress);
          
          // Prepare the order parameters
          const orderParams = {
            srcChainId: msg.orderParams?.srcChainId || 1, // Default to Ethereum mainnet
            dstChainId: msg.orderParams?.dstChainId || 0, // Default to Monero (0)
            srcTokenAddress: msg.orderParams?.srcTokenAddress || '0x0000000000000000000000000000000000000000', // Default to ETH
            dstTokenAddress: msg.orderParams?.dstTokenAddress || 'XMR', // Default to XMR
            amount: msg.orderParams?.amount,
            walletAddress: ethAddress,
            xmrAddress: xmrAddress
          };
          
          console.log('📋 Prepared order parameters:', orderParams);
          
          // Call the 1InchMicroservice API to create an atomic swap order
          const response = await fetch('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderParams)
          });
          
          const responseData = await response.json();
          console.log('📥 1InchMicroservice API response:', responseData);
          
          // Call the swap daemon's makeOffer endpoint
          const ethToXmrRate = '15.5'; // Example rate: 1 ETH = 15.5 XMR
          const amountInEth = parseFloat(msg.orderParams?.amount || '0');
          const minAmountXmr = (amountInEth * parseFloat(ethToXmrRate) * 0.95).toString(); // 5% below target
          const maxAmountXmr = (amountInEth * parseFloat(ethToXmrRate) * 1.05).toString(); // 5% above target
          
          // Prepare the JSON-RPC request for the swap daemon
          const jsonRpcRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'net_makeOffer',
            params: {
              minAmount: minAmountXmr,
              maxAmount: maxAmountXmr,
              exchangeRate: ethToXmrRate,
              ethAsset: 'ETH',
              // Optional parameters
              relayerEndpoint: 'http://localhost:3000/api/relayer'
            }
          };
          
          // Create a formatted JSON string for logging
          const jsonString = JSON.stringify(jsonRpcRequest, null, 4);
          console.log('🌐 Swap daemon JSON-RPC request:', jsonRpcRequest);
          
          // Log the equivalent curl command for manual testing
          const curlCommand = `curl -s -X POST "http://127.0.0.1:5000" -H 'Content-Type: application/json' -d '${jsonString}' | jq`;
          console.log('📋 Equivalent curl command for testing:\n', curlCommand);
          
          // Call the swap daemon endpoint using the standard JSON-RPC endpoint
          const swapDaemonResponse = await fetch('http://127.0.0.1:5000', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonRpcRequest)
          });
          
          // Safely parse the response
          let swapDaemonData;
          try {
            const text = await swapDaemonResponse.text();
            swapDaemonData = JSON.parse(text);
            console.log('🌐 Swap daemon response:', swapDaemonData);
          } catch (jsonError) {
            console.error('❌ Invalid JSON response from swap daemon');
            swapDaemonData = { error: 'Invalid JSON response from swap daemon' };
          }
          
          sendResponse({ 
            success: true, 
            orderData: responseData,
            swapDaemonData: swapDaemonData
          });
        } catch (error) {
          console.error('❌ Error creating atomic swap order:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error creating atomic swap order' });
        }
      }
      
      // Handle direct swap daemon calls
      if (msg.type === 'callSwapDaemon') {
        console.log('🌐 Calling swap daemon with method:', msg.method, 'and params:', msg.params);
        
        try {
          // Prepare the JSON-RPC request - ensure params is properly formatted as an object
          // The swap daemon expects params as an object, not as a direct value
          const jsonRpcRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: msg.method,
            // If params is already an object, use it directly; otherwise wrap it
            params: typeof msg.params === 'object' && msg.params !== null ? msg.params : { params: msg.params }
          };
          
          // Create a formatted JSON string for logging
          const jsonString = JSON.stringify(jsonRpcRequest, null, 4);
          console.log('🌐 JSON-RPC request:', jsonRpcRequest);
          
          // Log the equivalent curl command for manual testing
          const curlCommand = `curl -s -X POST "http://127.0.0.1:5000" -H 'Content-Type: application/json' -d '${jsonString}' | jq`;
          console.log('📋 Equivalent curl command for testing:\n', curlCommand);
          
          // Call the swap daemon endpoint - don't append the method to the URL
          // The JSON-RPC standard uses a single endpoint for all methods
          const response = await fetch('http://127.0.0.1:5000', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonRpcRequest)
          });
          
          // Check if the response is valid JSON before parsing
          const text = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(text);
            console.log('🌐 Swap daemon response:', responseData);
          } catch (jsonError) {
            console.error('❌ Invalid JSON response from swap daemon:', text);
            throw new Error('Invalid JSON response from swap daemon');
          }
          
          sendResponse({ 
            success: true, 
            data: responseData
          });
        } catch (error) {
          console.error('❌ Error calling swap daemon:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error calling swap daemon' });
        }
      }
      
      if (msg.type === 'getAtomicSwapOrder') {
        try {
          const { orderId } = msg;
          console.log('🔍 Getting atomic swap order details for:', orderId);
          
          // Make API request to the microservice
          const response = await fetch(`http://localhost:3000/api/orders/${orderId}`);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get order details');
          }
          
          const responseData = await response.json();
          console.log('📥 Order details response:', responseData);
          
          if (!responseData.success) {
            throw new Error(responseData.error || 'Failed to get order details');
          }
          
          // Return the order details
          sendResponse({
            success: true,
            data: responseData.data
          });
        } catch (error) {
          console.error('❌ Error getting atomic swap order:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error getting order'
          });
        }
      }
      
      if (msg.type === 'initiateAtomicSwap') {
        try {
          const { orderId } = msg;
          console.log('🚀 Initiating atomic swap for order:', orderId);
          
          // First get the order details
          const orderResponse = await fetch(`http://localhost:3000/api/orders/${orderId}`);
          if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            throw new Error(errorData.error || 'Failed to get order details');
          }
          
          const orderData = await orderResponse.json();
          if (!orderData.success) {
            throw new Error(orderData.error || 'Failed to get order details');
          }
          
          const order = orderData.data;
          
          // Create a swap using the order details
          const swapResponse = await fetch('http://localhost:3000/api/swaps', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderId: orderId,
              srcChainId: order.srcChainId,
              dstChainId: order.dstChainId,
              amount: order.amount
            })
          });
          
          if (!swapResponse.ok) {
            const errorData = await swapResponse.json();
            throw new Error(errorData.error || 'Failed to initiate swap');
          }
          
          const swapData = await swapResponse.json();
          console.log('📥 Swap initiation response:', swapData);
          
          if (!swapData.success) {
            throw new Error(swapData.error || 'Failed to initiate swap');
          }
          
          // Update the order status to link it with the swap
          await fetch(`http://localhost:3000/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'READY',
              swapId: swapData.data.swapId
            })
          });
          
          // Return the swap details
          sendResponse({
            success: true,
            data: swapData.data
          });
        } catch (error) {
          console.error('❌ Error initiating atomic swap:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error initiating swap'
          });
        }
      }
      
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: 'Internal error' });
    }
  })();
  
  return true;
});