import { SDK, NetworkEnum, HashLock } from '@1inch/cross-chain-sdk';
import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import config from '../../config/default';
import logger from '../common/logger';
import { SwapParams } from '../common/types';

// Helper function to generate random bytes32 since it's not exported from the SDK
function getRandomBytes32(): string {
  return '0x' + randomBytes(32).toString('hex');
}

export class OneInchService {
  private sdk: SDK;
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.baseSepolia.rpcUrl);
    this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);

    this.sdk = new SDK({
      url: config.oneInch.apiUrl,
      authKey: config.oneInch.authKey,
    } as any); // Type cast to any to bypass type checking for the SDK config

    // Set up the web3Caller after initialization
    (this.sdk as any).web3Caller = {
      ethCall: async (callData: any) => {
        return await this.provider.call(callData);
      },
      signTypedData: async (typedData: any) => {
        return await this.wallet._signTypedData(
          typedData.domain,
          typedData.types,
          typedData.message
        );
      },
    };
  }

  async getActiveOrders(page: number = 1, limit: number = 10) {
    try {
      const orders = await this.sdk.getActiveOrders({ page, limit });
      logger.info(`Retrieved ${orders.items?.length || 0} active orders`);
      return orders;
    } catch (error) {
      logger.error('Error retrieving active orders', { error });
      throw error;
    }
  }

  async getOrdersByMaker(address: string, page: number = 1, limit: number = 10) {
    try {
      const orders = await this.sdk.getOrdersByMaker({
        address,
        page,
        limit,
      });
      logger.info(`Retrieved ${orders.items?.length || 0} orders for maker ${address}`);
      return orders;
    } catch (error) {
      logger.error(`Error retrieving orders for maker ${address}`, { error });
      throw error;
    }
  }

  async getQuote(params: SwapParams) {
    try {
      const quoteParams = {
        srcChainId: params.srcChainId,
        dstChainId: params.dstChainId,
        srcTokenAddress: params.srcTokenAddress,
        dstTokenAddress: params.dstTokenAddress,
        amount: params.amount,
        walletAddress: params.walletAddress,
      };

      const quote = await this.sdk.getQuote(quoteParams);
      logger.info('Retrieved quote', { quoteParams });
      return quote;
    } catch (error) {
      logger.error('Error retrieving quote', { error, params });
      throw error;
    }
  }

  async createOrder(params: SwapParams) {
    try {
      // Get a quote for the swap
      const quote = await this.getQuote(params);

      // Generate secrets for the swap
      const secretsCount = quote.getPreset().secretsCount;
      
      // Use provided secrets or generate new ones
      const claimSecret = params.claimSecret || getRandomBytes32();
      const refundSecret = params.refundSecret || getRandomBytes32();
      
      // Create an array of secrets based on the required count
      const secrets = Array.from({ length: secretsCount }).map((_, i) => {
        if (i === 0) return claimSecret;
        if (i === 1) return refundSecret;
        return getRandomBytes32();
      });
      
      const secretHashes = secrets.map((x) => HashLock.hashSecret(x));

      // Create hash lock for the order
      const hashLock =
        secretsCount === 1
          ? HashLock.forSingleFill(secrets[0])
          : HashLock.forMultipleFills(
              secretHashes.map((secretHash, i) =>
                ethers.utils.solidityKeccak256(
                  ['uint64', 'bytes32'],
                  [i, secretHash.toString()]
                ) as any
              ) as any
            );

      // Create the order with the 1inch SDK
      const order = await this.sdk.createOrder(quote, {
        walletAddress: params.walletAddress,
        hashLock,
        secretHashes,
        // Optional fee configuration
        fee: {
          takingFeeBps: 100, // 1% fee
          takingFeeReceiver: config.relayer.address,
        },
      });

      logger.info('Created order', { 
        orderId: (order as any).orderHash || '',
        walletAddress: params.walletAddress,
        xmrAddress: params.xmrAddress,
        srcTokenAddress: params.srcTokenAddress,
        amount: params.amount
      });

      // Return order details along with the secrets for later use
      return {
        order: {
          ...order,
          orderHash: (order as any).orderHash || ''
        },
        secrets: {
          claim: claimSecret,
          refund: refundSecret
        },
        secretHashes: {
          claim: secretHashes[0],
          refund: secretHashes[1]
        }
      };
    } catch (error) {
      logger.error('Error creating order', { error, params });
      throw error;
    }
  }
}

export default new OneInchService();
