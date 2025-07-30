export default {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  // 1inch API configuration
  oneInch: {
    apiUrl: process.env.ONE_INCH_API_URL || 'https://api.1inch.dev/fusion-plus',
    authKey: process.env.ONE_INCH_AUTH_KEY || ''
  },
  
  // Blockchain configuration
  blockchain: {
    baseSepolia: {
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      chainId: 84532,
      contracts: {
        limitOrderProtocol: '0xE53136D9De56672e8D2665C98653AC7b8A60Dc44',
        swapCreator: '0xA8Eec88fC1A0096D2571a2c47aC9bF7492BfF39a',
        xmrEscrowSrc: '0x3d3F34A0C3ee6940C50B50DBaa1b2150ca119Fb3'
      }
    },
    privateKey: process.env.PRIVATE_KEY || ''
  },
  
  // XMR-ETH Swap Daemon configuration
  swapDaemon: {
    rpcUrl: process.env.SWAP_DAEMON_RPC_URL || 'http://localhost:8080',
    username: process.env.SWAP_DAEMON_USERNAME || '',
    password: process.env.SWAP_DAEMON_PASSWORD || ''
  },
  
  // Relayer configuration
  relayer: {
    feePercentage: process.env.RELAYER_FEE_PERCENTAGE || '1', // 1% fee
    minFee: process.env.RELAYER_MIN_FEE || '0.001', // 0.001 ETH
    address: process.env.RELAYER_ADDRESS || ''
  }
}
