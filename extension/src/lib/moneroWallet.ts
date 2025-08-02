// Define fallback values for MoneroNetworkType since we can't rely on monero-ts in browser
export const MoneroNetworkType = {
  MAINNET: 0,
  TESTNET: 1,
  STAGENET: 2
};

// Define a base MoneroWalletListener interface
export interface MoneroWalletListener {
  onSyncProgress?(height: number, startHeight: number, endHeight: number, percentDone: number, message: string): Promise<void>;
  onNewBlock?(height: number): Promise<void>;
  onBalancesChanged?(newBalance: bigint, newUnlockedBalance: bigint): Promise<void>;
  onOutputReceived?(output: any): Promise<void>;
  onOutputSpent?(output: any): Promise<void>;
}

// Create a base MoneroWalletListener class that implements all required methods
export class BaseMoneroWalletListener implements MoneroWalletListener {
  async onSyncProgress(height: number, startHeight: number, endHeight: number, percentDone: number, message: string) {}
  async onNewBlock(height: number) {}
  async onBalancesChanged(newBalance: bigint, newUnlockedBalance: bigint) {}
  async onOutputReceived(output: any) {}
  async onOutputSpent(output: any) {}
}

// Monero wallet class to handle all Monero-related functionality
export class MoneroWalletManager {
  // Helper methods for mock implementation
  private createMockWallet(config: {
    path: string;
    password: string;
    networkType: number;
    seed?: string;
    primaryAddress?: string;
    balance: bigint;
    unlockedBalance: bigint;
  }): any {
    // Generate a deterministic address if seed is provided, otherwise use the provided address or generate a random one
    const seed = config.seed || this.generateMockSeed();
    const primaryAddress = config.primaryAddress || this.generateMockAddress(seed);
    
    // Debug logging
    console.log('Creating mock Monero wallet with:');
    console.log('- Seed available:', !!seed);
    console.log('- Primary address:', primaryAddress);
    
    return {
      path: config.path,
      password: config.password,
      networkType: config.networkType,
      seed: seed,
      primaryAddress: primaryAddress,
      balance: config.balance,
      unlockedBalance: config.unlockedBalance,
      isConnected: true,
      isSynced: false,
      syncProgress: 0,
      listeners: [],
      // Mock methods
      addListener: async (listener: any) => {
        this.listeners.push(listener);
        return true;
      },
      sync: async () => {
        return { blocksRemaining: 0, progress: 1 };
      },
      startSyncing: async () => true,
      stopSyncing: async () => true,
      getPrimaryAddress: async () => {
        console.log('Mock wallet: getPrimaryAddress called, returning:', primaryAddress);
        return primaryAddress;
      },
      getSeed: async () => config.seed || '',
      getBalance: async () => config.balance,
      getUnlockedBalance: async () => config.unlockedBalance,
      createTx: async (txConfig: any) => ({
        getHash: () => this.generateRandomTxHash()
      }),
      getTxs: async () => [],
      close: async () => true,
      createSubaddress: async (accountIndex: number, label: string) => 0,
      getAddress: async (accountIndex: number, addressIndex: number) => this.generateMockAddress()
    };
  }

  private generateMockSeed(): string {
    // Generate a random 25-word seed phrase
    const words = [
      'abbey', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident', 'account', 'accuse',
      'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
      'adapt', 'add', 'addict', 'address', 'adjust'
    ];
    let seed = '';
    for (let i = 0; i < 25; i++) {
      seed += words[Math.floor(Math.random() * words.length)];
      if (i < 24) seed += ' ';
    }
    return seed;
  }

  private generateMockAddress(seedPhrase?: string): string {
    // Generate a deterministic Monero-like address based on ETH seed phrase
    const prefix = this.networkType === MoneroNetworkType.MAINNET ? '4' : 
                  this.networkType === MoneroNetworkType.TESTNET ? '9' : '5';
    let address = prefix;
    
    // If seed phrase is provided, use it to generate a deterministic address
    if (seedPhrase) {
      // Simple deterministic algorithm: use the seed phrase to generate a consistent hash
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      
      // Create a simple hash from the seed phrase
      let hash = 0;
      for (let i = 0; i < seedPhrase.length; i++) {
        hash = ((hash << 5) - hash) + seedPhrase.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      
      // Use the hash to deterministically generate the address
      const seedArray = seedPhrase.split(' ');
      for (let i = 0; i < 95; i++) {
        // Use different parts of the seed phrase based on position
        const wordIndex = i % seedArray.length;
        const word = seedArray[wordIndex];
        const charIndex = (hash + i + word.charCodeAt(i % word.length)) % chars.length;
        address += chars.charAt(Math.abs(charIndex));
      }
      
      return address;
    } else {
      // Fallback to random address if no seed phrase is provided
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      for (let i = 0; i < 95; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return address;
    }
  }

  private generateRandomTxHash(): string {
    // Generate a random transaction hash
    let hash = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < 64; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }
  private static instance: MoneroWalletManager;
  private wallet: any = null; // MoneroWalletFull type
  private isInitialized: boolean = false;
  private isSyncing: boolean = false;
  private listeners: any[] = [];
  private networkType: number = MoneroNetworkType.STAGENET; // Default to stagenet for safety
  private daemon: any = null; // MoneroDaemonRpc type
  
  // Singleton pattern
  public static getInstance(): MoneroWalletManager {
    if (!MoneroWalletManager.instance) {
      MoneroWalletManager.instance = new MoneroWalletManager();
    }
    return MoneroWalletManager.instance;
  }
  
  private constructor() {}
  
  /**
   * Initialize the Monero wallet with a seed phrase
   */
  public async initializeWallet(config: {
    path: string;
    password: string;
    seedPhrase?: string;
    networkType?: number;
    restoreHeight?: number;
    serverUri?: string;
    serverUsername?: string;
    serverPassword?: string;
  }): Promise<boolean> {
    try {
      // Connect to daemon if server URI is provided
      if (config.serverUri) {
        // Mock daemon connection in browser environment
        this.daemon = {
          uri: config.serverUri,
          username: config.serverUsername,
          password: config.serverPassword,
          isConnected: true
        };
        console.log('Connected to Monero daemon (mock)');
      }
      
      // Set network type
      this.networkType = config.networkType || MoneroNetworkType.STAGENET;
      
      // Create mock wallet in browser environment
      if (config.seedPhrase) {
        // Create wallet from seed - primaryAddress will be deterministically generated from the seed
        this.wallet = this.createMockWallet({
          path: config.path,
          password: config.password,
          networkType: this.networkType,
          seed: config.seedPhrase,
          // Don't specify primaryAddress so it will be deterministically generated from seed
          balance: BigInt(0),
          unlockedBalance: BigInt(0)
        });
        console.log('Monero wallet created from seed (mock) with deterministic address');
      } else {
        // Create new wallet
        const newSeed = this.generateMockSeed();
        this.wallet = this.createMockWallet({
          path: config.path,
          password: config.password,
          networkType: this.networkType,
          seed: newSeed,
          // Don't specify primaryAddress so it will be deterministically generated from seed
          balance: BigInt(0),
          unlockedBalance: BigInt(0)
        });
        console.log('New Monero wallet created (mock) with deterministic address');
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing Monero wallet:', error);
      return false;
    }
  }
  
  /**
   * Start syncing the wallet with the blockchain
   */
  public async startSyncing(refreshIntervalMs: number = 10000): Promise<void> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    if (this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      await this.wallet.startSyncing(refreshIntervalMs);
      console.log(`Monero wallet syncing started with interval: ${refreshIntervalMs}ms`);
    } catch (error) {
      this.isSyncing = false;
      console.error('Error starting wallet sync:', error);
      throw error;
    }
  }
  
  /**
   * Stop syncing the wallet
   */
  public async stopSyncing(): Promise<void> {
    if (!this.isInitialized || !this.wallet || !this.isSyncing) {
      return;
    }
    
    try {
      await this.wallet.stopSyncing();
      this.isSyncing = false;
      console.log('Monero wallet syncing stopped');
    } catch (error) {
      console.error('Error stopping wallet sync:', error);
      throw error;
    }
  }
  
  /**
   * Sync wallet with progress tracking
   */
  public async syncWallet(): Promise<void> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      await this.wallet.sync(new class extends BaseMoneroWalletListener {
        async onSyncProgress(height: number, startHeight: number, endHeight: number, percentDone: number, message: string) {
          console.log(`Sync progress: ${percentDone.toFixed(2)}% (${height}/${endHeight}) - ${message}`);
          chrome.runtime.sendMessage({
            type: 'moneroSyncProgress',
            data: {
              height,
              startHeight,
              endHeight,
              percentDone,
              message
            }
          });
        }
      });
      console.log('Monero wallet sync completed');
    } catch (error) {
      console.error('Error syncing wallet:', error);
      throw error;
    }
  }
  
  /**
   * Add a listener for wallet events
   */
  public async addListener(listener: any): Promise<void> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      await this.wallet.addListener(listener);
      this.listeners.push(listener);
      console.log('Listener added to Monero wallet');
    } catch (error) {
      console.error('Error adding wallet listener:', error);
      throw error;
    }
  }
  
  /**
   * Get the primary address of the wallet
   */
  public async getPrimaryAddress(): Promise<string> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      const address = await this.wallet.getPrimaryAddress();
      console.log('Retrieved Monero primary address:', address);
      
      // Ensure we're not returning an empty string or undefined
      if (!address) {
        console.warn('Primary address is empty, using wallet.primaryAddress directly');
        return this.wallet.primaryAddress || 'Address generation failed';
      }
      
      return address;
    } catch (error) {
      console.error('Error getting primary address:', error);
      // Fallback to direct property access in case the method fails
      if (this.wallet.primaryAddress) {
        console.log('Falling back to direct primaryAddress property:', this.wallet.primaryAddress);
        return this.wallet.primaryAddress;
      }
      throw error;
    }
  }
  
  /**
   * Get the wallet's seed phrase
   */
  public async getSeed(): Promise<string> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      return await this.wallet.getSeed();
    } catch (error) {
      console.error('Error getting seed:', error);
      throw error;
    }
  }
  
  /**
   * Get the wallet's balance
   */
  public async getBalance(): Promise<{total: bigint, unlocked: bigint}> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      const balance = await this.wallet.getBalance();
      const unlockedBalance = await this.wallet.getUnlockedBalance();
      return {
        total: balance,
        unlocked: unlockedBalance
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }
  
  /**
   * Create and send a transaction
   */
  public async createAndSendTransaction(config: {
    address: string;
    amount: bigint;
    paymentId?: string;
    priority?: number;
  }): Promise<string> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      const tx = await this.wallet.createTx({
        accountIndex: 0,
        address: config.address,
        amount: config.amount,
        paymentId: config.paymentId,
        priority: config.priority,
        relay: true // Send immediately
      });
      
      return tx.getHash();
    } catch (error) {
      console.error('Error creating and sending transaction:', error);
      throw error;
    }
  }
  
  /**
   * Get transaction history
   */
  public async getTransactions(): Promise<any[]> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      return await this.wallet.getTxs();
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }
  
  /**
   * Close the wallet
   */
  public async closeWallet(save: boolean = true): Promise<void> {
    if (!this.isInitialized || !this.wallet) {
      return;
    }
    
    try {
      await this.wallet.close(save);
      this.isInitialized = false;
      this.isSyncing = false;
      this.wallet = null;
      console.log('Monero wallet closed');
    } catch (error) {
      console.error('Error closing wallet:', error);
      throw error;
    }
  }
  
  /**
   * Check if wallet is initialized
   */
  public isWalletInitialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Check if wallet is syncing
   */
  public isWalletSyncing(): boolean {
    return this.isSyncing;
  }
  
  /**
   * Get a new subaddress
   */
  public async createSubaddress(label: string = ""): Promise<string> {
    if (!this.isInitialized || !this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      const subaddressIndex = await this.wallet.createSubaddress(0, label);
      return await this.wallet.getAddress(0, subaddressIndex);
    } catch (error) {
      console.error('Error creating subaddress:', error);
      throw error;
    }
  }
}

export default MoneroWalletManager;
