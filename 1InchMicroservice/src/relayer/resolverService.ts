import { ethers } from 'ethers';
import config from '../../config/default';
import logger from '../common/logger';

// ABI for the Resolver contract
const RESOLVER_ABI = [
  "function deploySrc(tuple immutables, tuple order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits, bytes args) external payable",
  "function deployDst(tuple dstImmutables, uint256 srcCancellationTimestamp) external payable",
  "function withdraw(address escrow, bytes32 secret, tuple immutables) external",
  "function cancel(address escrow, tuple immutables) external",
  "function arbitraryCalls(address[] targets, bytes[] arguments) external"
];

// ABI for the XMREscrowSrc contract
const XMR_ESCROW_SRC_ABI = [
  "function createEscrow(bytes32 orderHash, address token, uint256 amount, address, address, uint48, uint48, bytes extraData) external payable",
  "function withdrawWithRelayer(bytes32 orderHash, bytes32 secret, address payable relayer, uint256 fee, uint32 salt, uint8 v, bytes32 r, bytes32 s) external",
  "function withdraw(bytes32 secret, tuple immutables) external",
  "function publicWithdraw(bytes32 secret, tuple immutables) external",
  "function cancel(tuple immutables) external",
  "function publicCancel(tuple immutables) external",
  "function cancelWithSecret(bytes32 orderHash, bytes32 refundSecret) external"
];

export class ResolverService {
  private provider!: ethers.providers.JsonRpcProvider;
  private wallet!: ethers.Wallet;
  private _resolver: ethers.Contract | null = null;
  private _xmrEscrowSrc: ethers.Contract | null = null;

  constructor() {
    try {
      // Only initialize provider and wallet in constructor
      this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.baseSepolia.rpcUrl);
      
      // Use environment variable for private key if available
      const privateKey = process.env.PRIVATE_KEY || config.blockchain.privateKey;
      if (!privateKey) {
        throw new Error('Private key is not configured');
      }
      
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      logger.info(`ResolverService initialized with wallet: ${this.wallet.address}`);
    } catch (error) {
      logger.error('Error initializing ResolverService', { error });
      // Don't throw here, let the service start but contract calls will fail
    }
  }
  
  // Lazy initialization of resolver contract
  private get resolver(): ethers.Contract {
    if (!this._resolver) {
      try {
        this._resolver = new ethers.Contract(
          config.blockchain.baseSepolia.contracts.limitOrderProtocol,
          RESOLVER_ABI,
          this.wallet
        );
      } catch (error) {
        logger.error('Error initializing Resolver contract', { error });
        throw error;
      }
    }
    return this._resolver;
  }
  
  // Lazy initialization of XMREscrowSrc contract
  private get xmrEscrowSrc(): ethers.Contract {
    if (!this._xmrEscrowSrc) {
      try {
        this._xmrEscrowSrc = new ethers.Contract(
          config.blockchain.baseSepolia.contracts.xmrEscrowSrc,
          XMR_ESCROW_SRC_ABI,
          this.wallet
        );
      } catch (error) {
        logger.error('Error initializing XMREscrowSrc contract', { error });
        throw error;
      }
    }
    return this._xmrEscrowSrc;
  }

  /**
   * Deploy a source escrow contract through the Resolver
   */
  async deploySrcEscrow(
    immutables: any,
    order: any,
    r: string,
    vs: string,
    amount: string,
    takerTraits: string,
    args: string,
    value: string
  ) {
    try {
      const tx = await this.resolver.deploySrc(
        immutables,
        order,
        r,
        vs,
        amount,
        takerTraits,
        args,
        { value: ethers.utils.parseEther(value) }
      );
      
      const receipt = await tx.wait();
      logger.info('Deployed source escrow', { 
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
      
      return receipt;
    } catch (error) {
      logger.error('Error deploying source escrow', { error });
      throw error;
    }
  }

  /**
   * Deploy a destination escrow contract through the Resolver
   */
  async deployDstEscrow(
    dstImmutables: any,
    srcCancellationTimestamp: number,
    value: string
  ) {
    try {
      const tx = await this.resolver.deployDst(
        dstImmutables,
        srcCancellationTimestamp,
        { value: ethers.utils.parseEther(value) }
      );
      
      const receipt = await tx.wait();
      logger.info('Deployed destination escrow', { 
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
      
      return receipt;
    } catch (error) {
      logger.error('Error deploying destination escrow', { error });
      throw error;
    }
  }

  /**
   * Withdraw from an escrow contract through the Resolver
   */
  async withdrawFromEscrow(escrow: string, secret: string, immutables: any) {
    try {
      const tx = await this.resolver.withdraw(escrow, secret, immutables);
      const receipt = await tx.wait();
      
      logger.info('Withdrew from escrow', { 
        escrow,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
      
      return receipt;
    } catch (error) {
      logger.error('Error withdrawing from escrow', { error });
      throw error;
    }
  }

  /**
   * Cancel an escrow contract through the Resolver
   */
  async cancelEscrow(escrow: string, immutables: any) {
    try {
      const tx = await this.resolver.cancel(escrow, immutables);
      const receipt = await tx.wait();
      
      logger.info('Cancelled escrow', { 
        escrow,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
      
      return receipt;
    } catch (error) {
      logger.error('Error cancelling escrow', { error });
      throw error;
    }
  }

  /**
   * Withdraw from XMREscrowSrc using the relayer functionality
   */
  async withdrawWithRelayer(
    orderHash: string,
    secret: string,
    fee: string,
    salt: number
  ) {
    try {
      // Get the current nonce for the relayer address
      const nonce = await this.provider.getTransactionCount(this.wallet.address);
      
      // Create a signature for the relayer withdrawal
      const domain = {
        name: 'XMREscrowSrc',
        version: '1',
        chainId: config.blockchain.baseSepolia.chainId,
        verifyingContract: config.blockchain.baseSepolia.contracts.xmrEscrowSrc
      };
      
      const types = {
        RelayerWithdrawal: [
          { name: 'orderHash', type: 'bytes32' },
          { name: 'secret', type: 'bytes32' },
          { name: 'relayer', type: 'address' },
          { name: 'fee', type: 'uint256' },
          { name: 'salt', type: 'uint32' }
        ]
      };
      
      const value = {
        orderHash,
        secret,
        relayer: this.wallet.address,
        fee: ethers.utils.parseEther(fee),
        salt
      };
      
      // Sign the typed data
      const signature = await this.wallet._signTypedData(domain, types, value);
      
      // Extract v, r, s from the signature
      const sig = ethers.utils.splitSignature(signature);
      
      // Call the withdrawWithRelayer function
      const tx = await this.xmrEscrowSrc.withdrawWithRelayer(
        orderHash,
        secret,
        this.wallet.address,
        ethers.utils.parseEther(fee),
        salt,
        sig.v,
        sig.r,
        sig.s
      );
      
      const receipt = await tx.wait();
      logger.info('Withdrew with relayer', { 
        orderHash,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
      
      return receipt;
    } catch (error) {
      logger.error('Error withdrawing with relayer', { error });
      throw error;
    }
  }

  /**
   * Create an escrow directly through the XMREscrowSrc contract
   */
  async createEscrow(
    orderHash: string,
    token: string,
    amount: string,
    extraData: string,
    value: string
  ) {
    try {
      const tx = await this.xmrEscrowSrc.createEscrow(
        orderHash,
        token,
        ethers.utils.parseEther(amount),
        ethers.constants.AddressZero, // placeholder
        ethers.constants.AddressZero, // placeholder
        0, // placeholder
        0, // placeholder
        extraData,
        { value: ethers.utils.parseEther(value) }
      );
      
      const receipt = await tx.wait();
      logger.info('Created escrow', { 
        orderHash,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      });
      
      return receipt;
    } catch (error) {
      logger.error('Error creating escrow', { error });
      throw error;
    }
  }
}

export default new ResolverService();
