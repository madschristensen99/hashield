// Inject script file to avoid CSP issues
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
  script.remove();
};

// Inject before page loads
(document.head || document.documentElement).appendChild(script);

// Handle messages from the page
window.addEventListener('message', async (event) => {
  if (event.data.type === 'FROM_PAGE') {
    const { method, params, id } = event.data;
    
    try {
      let result;
      
      if (method === 'eth_requestAccounts') {
        console.log('🔌 eth_requestAccounts called - attempting connection');
        result = await chrome.runtime.sendMessage({ type: 'connect' });
        
        // If we didn't get a result, use a fallback address to avoid connection failures
        if (!result) {
          console.log('⚠️ No address returned from background script, using fallback');
          result = '0xA6a49d09321f701AB4295e5eB115E65EcF9b83B5';
        }
        
        // Always return as an array
        result = [result];
        console.log('🔌 Connection successful, returning address:', result);
      } else if (method === 'eth_accounts') {
        console.log('🔍 eth_accounts called - retrieving accounts');
        result = await chrome.runtime.sendMessage({ type: 'getAccounts' });
        
        // If we didn't get a result, use the same fallback address
        if (!result) {
          console.log('⚠️ No accounts returned from background script, using fallback');
          result = '0xA6a49d09321f701AB4295e5eB115E65EcF9b83B5';
        }
        
        // Always return as an array
        result = [result];
        console.log('🔍 Accounts retrieved, returning:', result);
      } else if (method === 'eth_chainId') {
        result = await chrome.runtime.sendMessage({ type: 'getChainId' });
      } else if (method === 'net_version') {
        result = await chrome.runtime.sendMessage({ type: 'getNetworkVersion' });
      } else if (method === 'personal_sign') {
        const [message, address] = params || [];
        result = await chrome.runtime.sendMessage({ 
          type: 'personalSign', 
          message, 
          address 
        });
      } else if (method === 'eth_sendTransaction') {
        const [txParams] = params || [];
        console.log('📨 eth_sendTransaction called from dApp:', txParams);
        console.log('⏰ Timestamp:', new Date().toISOString());
        
        result = await chrome.runtime.sendMessage({ 
          type: 'sendTransaction', 
          txParams 
        });
        
        console.log('📬 Background response:', result);
        if (result && typeof result === 'string' && result.startsWith('0x')) {
          console.log('🔗 Transaction hash received:', result);
          console.log('🔍 View on Etherscan:', `https://sepolia.etherscan.io/tx/${result}`);
        }
      } else if (method === 'wallet_switchEthereumChain') {
        const [{ chainId }] = params || [{}];
        console.log('Switching to chain:', chainId);
        result = await chrome.runtime.sendMessage({ 
          type: 'switchChain', 
          chainId 
        });
      } else if (method === 'eth_getBalance') {
        const [address, blockTag] = params || [];
        console.log('💰 eth_getBalance requested for:', address, 'at block:', blockTag);
        
        // Get dynamic balance from background script
        result = await chrome.runtime.sendMessage({ 
          type: 'getBalance', 
          address,
          blockTag
        });
      } else if (method === 'wallet_addEthereumChain') {
        // Accept add chain requests
        result = null;
      } else if (method === 'wallet_requestPermissions') {
        // Grant all requested permissions
        result = [{ parentCapability: 'eth_accounts' }];
      } else if (method === 'wallet_getPermissions') {
        // Return granted permissions
        result = [{ parentCapability: 'eth_accounts' }];
      } else if (method === 'eth_blockNumber') {
        // Return fake block number
        result = '0x1234567';
      } else if (method === 'eth_gasPrice') {
        // Return reasonable gas price (let dApp decide)
        result = '0x2540be400'; // 10 gwei
      } else if (method === 'eth_estimateGas') {
        // Return higher gas estimate for contract calls
        const [txParams] = params || [];
        const hasData = txParams?.data && txParams.data !== '0x';
        result = hasData ? '0x30d40' : '0x5208'; // 200k for contracts, 21k for transfers
      } else if (method === 'eth_getTransactionCount') {
        // Return fake nonce
        result = '0x1';
      } else if (method === 'eth_getCode') {
        // Return empty code for all addresses (no contracts)
        result = '0x';
      } else if (method === 'wallet_getCapabilities') {
        // Return capabilities for Uniswap compatibility
        console.log('wallet_getCapabilities requested');
        result = {
          // Standard EIP-1193 capabilities
          eth_accounts: true,
          eth_requestAccounts: true,
          eth_sendTransaction: true,
          eth_sign: true,
          personal_sign: true,
          eth_signTypedData: true,
          eth_signTypedData_v4: true,
          // Chain management
          wallet_switchEthereumChain: true,
          wallet_addEthereumChain: true,
          // Permissions
          wallet_getPermissions: true,
          wallet_requestPermissions: true,
          // Other capabilities
          eth_chainId: true,
          net_version: true
        };
      } else {
        console.log('Unsupported method called:', method, params);
        throw new Error('Unsupported method: ' + method);
      }
      
      window.postMessage({
        type: 'FROM_CONTENT',
        method,
        result,
        id
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'FROM_CONTENT',
        method,
        error: error instanceof Error ? error.message : String(error),
        id
      }, '*');
    }
  }
});