import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/default';
import logger from '../common/logger';
import { SwapDaemonResponse } from '../common/types';

/**
 * Service for interacting with the XMR-ETH atomic swap daemon via JSON-RPC
 * Based on the API described in https://github.com/madschristensen99/xmr-eth-atomic-swap/blob/0a2f8aff8b6975666127dcea1b0377b8cb3fbe60/docs/rpc.md
 */
export class SwapDaemonService {
  private rpcUrl: string;
  private auth: {
    username: string;
    password: string;
  };

  constructor() {
    this.rpcUrl = config.swapDaemon.rpcUrl;
    this.auth = {
      username: config.swapDaemon.username,
      password: config.swapDaemon.password,
    };
  }

  /**
   * Make a JSON-RPC call to the swap daemon
   */
  private async callRpc(method: string, params: any = []): Promise<SwapDaemonResponse> {
    try {
      const response = await axios.post(
        this.rpcUrl,
        {
          jsonrpc: '2.0',
          id: uuidv4(),
          method,
          params,
        },
        {
          auth: this.auth,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error calling swap daemon RPC method ${method}`, { error });
      throw error;
    }
  }

  /**
   * Get the status of the swap daemon
   */
  async getStatus(): Promise<any> {
    const response = await this.callRpc('get_status');
    return response.result;
  }

  /**
   * Create a new ETH-XMR swap
   * @param ethAddress Ethereum address for the swap
   * @param xmrAddress Monero address for the swap
   * @param amount Amount of XMR to swap
   * @param claimSecretHash Hash of the claim secret
   * @param refundSecretHash Hash of the refund secret
   */
  async createSwap(
    ethAddress: string,
    xmrAddress: string,
    amount: string,
    claimSecretHash: string,
    refundSecretHash: string
  ): Promise<any> {
    const response = await this.callRpc('create_swap', [
      ethAddress,
      xmrAddress,
      amount,
      claimSecretHash,
      refundSecretHash,
    ]);
    
    if (response.error) {
      logger.error('Error creating swap in daemon', { error: response.error });
      throw new Error(`Swap daemon error: ${response.error.message}`);
    }
    
    logger.info('Created swap in daemon', { swapId: response.result.swap_id });
    return response.result;
  }

  /**
   * Get the details of a specific swap
   * @param swapId ID of the swap to retrieve
   */
  async getSwap(swapId: string): Promise<any> {
    const response = await this.callRpc('get_swap', [swapId]);
    
    if (response.error) {
      logger.error(`Error retrieving swap ${swapId}`, { error: response.error });
      throw new Error(`Swap daemon error: ${response.error.message}`);
    }
    
    return response.result;
  }

  /**
   * Get all swaps from the daemon
   */
  async getAllSwaps(): Promise<any> {
    const response = await this.callRpc('get_all_swaps');
    
    if (response.error) {
      logger.error('Error retrieving all swaps', { error: response.error });
      throw new Error(`Swap daemon error: ${response.error.message}`);
    }
    
    return response.result;
  }

  /**
   * Set a swap to the ready state
   * @param swapId ID of the swap to set as ready
   */
  async setSwapReady(swapId: string): Promise<any> {
    const response = await this.callRpc('set_swap_ready', [swapId]);
    
    if (response.error) {
      logger.error(`Error setting swap ${swapId} as ready`, { error: response.error });
      throw new Error(`Swap daemon error: ${response.error.message}`);
    }
    
    logger.info(`Set swap ${swapId} as ready`);
    return response.result;
  }

  /**
   * Claim a swap using the claim secret
   * @param swapId ID of the swap to claim
   * @param secret Claim secret for the swap
   */
  async claimSwap(swapId: string, secret: string): Promise<any> {
    const response = await this.callRpc('claim_swap', [swapId, secret]);
    
    if (response.error) {
      logger.error(`Error claiming swap ${swapId}`, { error: response.error });
      throw new Error(`Swap daemon error: ${response.error.message}`);
    }
    
    logger.info(`Claimed swap ${swapId}`);
    return response.result;
  }

  /**
   * Refund a swap using the refund secret
   * @param swapId ID of the swap to refund
   * @param secret Refund secret for the swap
   */
  async refundSwap(swapId: string, secret: string): Promise<any> {
    const response = await this.callRpc('refund_swap', [swapId, secret]);
    
    if (response.error) {
      logger.error(`Error refunding swap ${swapId}`, { error: response.error });
      throw new Error(`Swap daemon error: ${response.error.message}`);
    }
    
    logger.info(`Refunded swap ${swapId}`);
    return response.result;
  }
}

export default new SwapDaemonService();
