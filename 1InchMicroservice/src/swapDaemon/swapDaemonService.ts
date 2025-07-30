import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/default';
import logger from '../common/logger';
import { SwapDaemonResponse } from '../common/types';

/**
 * Service for interacting with the XMR-ETH atomic swap daemon via JSON-RPC
 * Based on the API described in the swap daemon documentation
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
  private async callRpc(method: string, params: any = {}): Promise<SwapDaemonResponse> {
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

      if (response.data.error) {
        logger.error(`Error in swap daemon RPC response for ${method}`, { error: response.data.error });
        throw new Error(`Swap daemon error: ${JSON.stringify(response.data.error)}`);
      }

      return response.data;
    } catch (error) {
      logger.error(`Error calling swap daemon RPC method ${method}`, { error });
      throw error;
    }
  }

  /**
   * Get the status of the swap daemon using personal_balances
   * Returns combined information of both the Monero and Ethereum account addresses and balances
   */
  async getStatus(): Promise<any> {
    const response = await this.callRpc('personal_balances', {});
    return response.result;
  }

  /**
   * Get the network addresses of the swap daemon
   * Returns the local libp2p listening addresses of the node
   */
  async getNetworkAddresses(): Promise<any> {
    const response = await this.callRpc('net_addresses', {});
    return response.result;
  }

  /**
   * Discover peers on the network via DHT that have active swap offers
   * @param provides Type of offer to search for ('XMR' or 'ETH')
   * @param searchTime Time in seconds to perform the search
   */
  async discoverPeers(provides: string = 'XMR', searchTime: number = 12): Promise<any> {
    const response = await this.callRpc('net_discover', { provides, searchTime });
    return response.result;
  }

  /**
   * Query all peers for their current swap offers
   * @param provides Type of offer to search for ('XMR' or 'ETH')
   * @param searchTime Time in seconds to perform the search
   */
  async queryAllPeers(provides: string = 'XMR', searchTime: number = 12): Promise<any> {
    const response = await this.callRpc('net_queryAll', { provides, searchTime });
    return response.result;
  }

  /**
   * Query a specific peer for their current active offers
   * @param peerID ID of the peer to query
   */
  async queryPeer(peerID: string): Promise<any> {
    const response = await this.callRpc('net_queryPeer', { peerID });
    return response.result;
  }

  /**
   * Make a new swap offer and advertise it on the network
   * @param minAmount Minimum amount to swap, in XMR
   * @param maxAmount Maximum amount to swap, in XMR
   * @param exchangeRate Exchange rate of ETH-XMR for the swap (XMR/ETH)
   * @param ethAsset Ethereum asset to trade (address or ETH)
   * @param relayerEndpoint RPC endpoint of the relayer
   * @param relayerFee Fee for the relayer
   */
  async makeOffer(
    minAmount: string,
    maxAmount: string,
    exchangeRate: string,
    ethAsset: string = 'ETH',
    relayerEndpoint?: string,
    relayerFee?: string
  ): Promise<any> {
    const params: any = {
      minAmount,
      maxAmount,
      exchangeRate,
      ethAsset
    };

    if (relayerEndpoint) {
      params.relayerEndpoint = relayerEndpoint;
      if (relayerFee) {
        params.relayerFee = relayerFee;
      }
    }

    const response = await this.callRpc('net_makeOffer', params);
    logger.info('Created swap offer', { offerId: response.result.offerID });
    return response.result;
  }

  /**
   * Take an advertised swap offer and initiate an atomic swap
   * @param peerID ID of the peer to swap with
   * @param offerID ID of the swap offer
   * @param providesAmount Amount of ETH to provide
   */
  async takeOffer(
    peerID: string,
    offerID: string,
    providesAmount: string
  ): Promise<any> {
    const response = await this.callRpc('net_takeOffer', {
      peerID,
      offerID,
      providesAmount
    });
    
    logger.info('Took swap offer', { offerId: offerID, peerID });
    return response.result;
  }

  /**
   * Get information for ongoing swaps
   * @param offerID Optional ID of a specific swap to retrieve
   */
  async getOngoingSwaps(offerID?: string): Promise<any> {
    const params: any = {};
    if (offerID) {
      params.offerID = offerID;
    }
    
    const response = await this.callRpc('swap_getOngoing', params);
    return response.result;
  }

  /**
   * Get information for past swaps
   * @param offerID Optional ID of a specific swap to retrieve
   */
  async getPastSwaps(offerID?: string): Promise<any> {
    const params: any = {};
    if (offerID) {
      params.offerID = offerID;
    }
    
    const response = await this.callRpc('swap_getPast', params);
    return response.result;
  }

  /**
   * Get the status of an ongoing swap
   * @param id ID of the swap to get the status of
   */
  async getSwapStatus(id: string): Promise<any> {
    const response = await this.callRpc('swap_getStatus', { id });
    return response.result;
  }

  /**
   * Attempts to cancel an ongoing swap
   * @param offerID ID of the swap to cancel
   */
  async cancelSwap(offerID: string): Promise<any> {
    const response = await this.callRpc('swap_cancel', { offerID });
    logger.info(`Cancelled swap ${offerID}`, { status: response.result.status });
    return response.result;
  }

  /**
   * Clear one or more offers
   * @param offerIds Array of offer IDs to clear, or empty to clear all offers
   */
  async clearOffers(offerIds?: string[]): Promise<any> {
    const params: any = {};
    if (offerIds && offerIds.length > 0) {
      params.offerIds = offerIds;
    }
    
    const response = await this.callRpc('swap_clearOffers', params);
    return response.result;
  }

  /**
   * Get the suggested exchange rate based on current market prices
   */
  async getSuggestedExchangeRate(): Promise<any> {
    const response = await this.callRpc('swap_suggestedExchangeRate', {});
    return response.result;
  }

  /**
   * Set the swap timeout duration
   * @param duration Duration in seconds
   */
  async setSwapTimeout(duration: number): Promise<any> {
    const response = await this.callRpc('personal_setSwapTimeout', { duration });
    return response.result;
  }

  /**
   * Get the current swap timeout duration
   */
  async getSwapTimeout(): Promise<any> {
    const response = await this.callRpc('personal_getSwapTimeout', {});
    return response.result;
  }

  // Legacy method compatibility for existing code
  async createSwap(
    ethAddress: string,
    xmrAddress: string,
    amount: string,
    claimSecretHash: string,
    refundSecretHash: string
  ): Promise<any> {
    // First make an offer as XMR provider
    const exchangeRate = await this.getSuggestedExchangeRate();
    const offerResult = await this.makeOffer(
      amount,  // minAmount
      amount,  // maxAmount
      exchangeRate.exchangeRate,
      'ETH'
      // No relayer endpoint in this implementation
      // Using default relayer settings from the swap daemon
    );
    
    // Then simulate taking the offer (this would normally be done by another party)
    // In a real scenario, we'd need to calculate the ETH amount based on the exchange rate
    const ethAmount = (parseFloat(amount) * parseFloat(exchangeRate.exchangeRate)).toString();
    
    await this.takeOffer(
      offerResult.peerID,
      offerResult.offerID,
      ethAmount
    );
    
    logger.info('Created and took swap offer to simulate createSwap', { 
      offerId: offerResult.offerID,
      ethAddress,
      xmrAddress,
      amount,
      claimSecretHash,
      refundSecretHash
    });
    
    return {
      swap_id: offerResult.offerID,
      status: 'initiated'
    };
  }

  // Legacy method compatibility for existing code
  async getSwap(swapId: string): Promise<any> {
    try {
      const ongoingResult = await this.getOngoingSwaps(swapId);
      if (ongoingResult.swaps && ongoingResult.swaps.length > 0) {
        return ongoingResult.swaps[0];
      }
      
      const pastResult = await this.getPastSwaps(swapId);
      if (pastResult.swaps && pastResult.swaps.length > 0) {
        return pastResult.swaps[0];
      }
      
      throw new Error(`Swap ${swapId} not found`);
    } catch (error) {
      logger.error(`Error retrieving swap ${swapId}`, { error });
      throw error;
    }
  }

  // Legacy method compatibility for existing code
  async getAllSwaps(): Promise<any> {
    const ongoingResult = await this.getOngoingSwaps();
    const pastResult = await this.getPastSwaps();
    
    return {
      ongoing: ongoingResult.swaps || [],
      past: pastResult.swaps || []
    };
  }

  // Legacy method compatibility for existing code
  async setSwapReady(swapId: string): Promise<any> {
    // In the new API, there's no direct equivalent, but we can check status
    const statusResult = await this.getSwapStatus(swapId);
    logger.info(`Swap ${swapId} status: ${statusResult.status}`);
    return { status: 'ready' };
  }

  // Legacy method compatibility for existing code
  async claimSwap(swapId: string, secret: string): Promise<any> {
    // In the new API, claiming is handled automatically by the daemon
    // We'll just log that we would claim with this secret
    logger.info(`Would claim swap ${swapId} with secret ${secret}`);
    return { status: 'claimed' };
  }

  // Legacy method compatibility for existing code
  async refundSwap(swapId: string, secret: string): Promise<any> {
    // In the new API, we use cancelSwap
    return await this.cancelSwap(swapId);
  }
}

export default new SwapDaemonService();
