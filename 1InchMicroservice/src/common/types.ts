// Common types used across the microservice

export interface SwapParams {
  // Order parameters
  srcChainId: number;
  dstChainId: number;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  walletAddress: string;
  
  // XMR-specific parameters
  xmrAddress: string;
  claimSecret?: string;
  refundSecret?: string;
  nonce?: string;
}

export interface OrderDetails {
  orderId: string;
  swapId: string;
  srcChainId: number;
  dstChainId: number;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  walletAddress: string;
  xmrAddress: string;
  status: 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
  claimSecret?: string;
  refundSecret?: string;
  claimSecretHash?: string;
  refundSecretHash?: string;
}

export interface SwapDaemonResponse {
  id: string;
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface RelayerRequest {
  orderId: string;
  swapId: string;
  secret: string;
  relayerFee: string;
}

// 1inch SDK types
export interface ActiveOrdersResponse {
  items: any[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface OrdersByMakerResponse {
  items: any[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface PreparedOrder {
  orderHash: string;
  signature: string;
  data: any;
}

export interface OrderCreationResult {
  order: PreparedOrder;
  secrets: {
    claim: string;
    refund: string;
  };
  secretHashes: {
    claim: string;
    refund: string;
  };
}
