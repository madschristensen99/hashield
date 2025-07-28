/**
 * SwapD JSON-RPC Client
 * 
 * This module provides a client for interacting with the swapd JSON-RPC API
 * to facilitate atomic swaps between ETH and XMR.
 */

import axios from 'axios';

export interface SwapOffer {
  offerID: string;
  provides: string;
  minAmount: string;
  maxAmount: string;
  exchangeRate: string;
  ethAsset: string;
}

export interface PeerWithOffers {
  peerID: string;
  offers: SwapOffer[];
}

export interface SwapStatus {
  status: string;
  info?: string;
  startTime?: string;
}

export interface OngoingSwap {
  id: string;
  provided: string;
  providedAmount: string;
  expectedAmount: string;
  exchangeRate: string;
  status: string;
  startTime: string;
  timeout1: string;
  timeout2: string;
}

export interface PastSwap {
  id: string;
  provided: string;
  providedAmount: string;
  expectedAmount: string;
  exchangeRate: string;
  status: string;
  startTime: string;
  endTime: string;
}

export interface ExchangeRateInfo {
  ethUpdatedAt: string;
  ethPrice: string;
  xmrUpdatedAt: string;
  xmrPrice: string;
  exchangeRate: string;
}

export class SwapDClient {
  private rpcUrl: string;
  private jsonRpcVersion = '2.0';
  private requestId = 0;

  constructor(rpcUrl: string = 'http://127.0.0.1:5000') {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Make a JSON-RPC call to the swapd daemon
   */
  private async call<T>(method: string, params: any = {}): Promise<T> {
    const requestData = {
      jsonrpc: this.jsonRpcVersion,
      id: (this.requestId++).toString(),
      method,
      params
    };

    try {
      const response = await axios.post(this.rpcUrl, requestData, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.error) {
        throw new Error(`SwapD RPC Error: ${JSON.stringify(response.data.error)}`);
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`SwapD Connection Error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Discover peers on the network via DHT that have active swap offers and gets all their swap offers.
   */
  async queryAllOffers(searchTime: number = 12): Promise<{ peersWithOffers: PeerWithOffers[] }> {
    return this.call<{ peersWithOffers: PeerWithOffers[] }>('net_queryAll', { searchTime });
  }

  /**
   * Query a specific peer for their current active offers.
   */
  async queryPeerOffers(peerID: string): Promise<{ offers: SwapOffer[] }> {
    return this.call<{ offers: SwapOffer[] }>('net_queryPeer', { peerID });
  }

  /**
   * Make a new swap offer and advertise it on the network.
   */
  async makeOffer(
    minAmount: string,
    maxAmount: string,
    exchangeRate: string,
    ethAsset: string = 'ETH',
    relayerEndpoint?: string,
    relayerFee?: string
  ): Promise<{ peerID: string; offerID: string }> {
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

    return this.call<{ peerID: string; offerID: string }>('net_makeOffer', params);
  }

  /**
   * Take an advertised swap offer. This call will initiate and execute an atomic swap.
   */
  async takeOffer(peerID: string, offerID: string, providesAmount: string): Promise<null> {
    return this.call<null>('net_takeOffer', {
      peerID,
      offerID,
      providesAmount
    });
  }

  /**
   * Gets information for ongoing swaps.
   */
  async getOngoingSwaps(offerID?: string): Promise<{ swaps: OngoingSwap[] }> {
    const params = offerID ? { offerID } : {};
    return this.call<{ swaps: OngoingSwap[] }>('swap_getOngoing', params);
  }

  /**
   * Gets information for past swaps.
   */
  async getPastSwaps(offerID?: string): Promise<{ swaps: PastSwap[] }> {
    const params = offerID ? { offerID } : {};
    return this.call<{ swaps: PastSwap[] }>('swap_getPast', params);
  }

  /**
   * Gets the status of an ongoing swap.
   */
  async getSwapStatus(id: string): Promise<SwapStatus> {
    return this.call<SwapStatus>('swap_getStatus', { id });
  }

  /**
   * Attempts to cancel an ongoing swap.
   */
  async cancelSwap(offerID: string): Promise<{ status: string }> {
    return this.call<{ status: string }>('swap_cancel', { offerID });
  }

  /**
   * Returns the current mainnet exchange rate expressed as the XMR/ETH price ratio.
   */
  async getSuggestedExchangeRate(): Promise<ExchangeRateInfo> {
    return this.call<ExchangeRateInfo>('swap_suggestedExchangeRate', {});
  }

  /**
   * Returns combined information of both the Monero and Ethereum account addresses and balances.
   */
  async getBalances(): Promise<{
    moneroAddress: string;
    piconeroBalance: number;
    piconeroUnlockedBalance: number;
    blocksToUnlock: number;
    ethAddress: string;
    weiBalance: string;
  }> {
    return this.call('personal_balances', {});
  }

  /**
   * Simple ping method to check if SwapD daemon is accessible
   */
  async ping(): Promise<boolean> {
    try {
      // Call a lightweight method to check connectivity
      await this.call('swap_suggestedExchangeRate', {});
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default SwapDClient;
