# Hashield 1inch Microservice

## Overview

This microservice is the central coordination hub for Hashield's cross-chain operations, integrating the Monero-ETH atomic swap protocol with the 1inch Limit Order Protocol. It orchestrates all services required for seamless cross-chain transactions, including order management, relaying, and direct communication with the Monero-ETH swap daemon.

## Architecture

### Core Components

1. **Monero-ETH Swap Daemon Integration**
   - Direct communication with the atomic-swap daemon
   - Management of swap states and lifecycle
   - Handling of Monero cryptographic operations
   - Coordination of on-chain ETH transactions with off-chain XMR transactions

2. **Order Management**
   - Create and sign limit orders
   - Post orders to the off-chain order book
   - Track order status and history

3. **Relayer Service**
   - Monitor the order book for fillable orders
   - Execute orders when conditions are met
   - Trigger swap daemon operations

4. **XMR-ETH Bridge**
   - Interface with Monero nodes
   - Coordinate with SwapCreator contract
   - Ensure atomic execution across chains

5. **API Layer**
   - Endpoints for order creation
   - Status checking and history
   - Webhook notifications
   - Swap daemon control interface

### Technical Flow

```
User/Extension → Create Order → Order Book
                                    ↓
                               Relayer Service
                                    ↓
                             Swap Daemon Controller
                               ↙           ↘
                      EVM Chain         Monero Chain
                      (LimitOrderProtocol)  (XMR Node)
                               ↘           ↙
                             Atomic Swap Result
```

## Integration Points

### Smart Contracts
- **LimitOrderProtocol**: `0xE53136D9De56672e8D2665C98653AC7b8A60Dc44` (Base Sepolia)
- **SwapCreator**: `0xA8Eec88fC1A0096D2571a2c47aC9bF7492BfF39a` (Base Sepolia)
- **XMREscrowSrc**: `0x3d3F34A0C3ee6940C50B50DBaa1b2150ca119Fb3` (Base Sepolia)

### Monero-ETH Swap Daemon
- **Communication Protocol**: gRPC/REST API
- **Daemon Location**: Runs as a companion service
- **Key Functions**:
  - XMR transaction creation and signing
  - Secret key management
  - Cryptographic proof generation
  - Cross-chain state monitoring

### External Services
- 1inch API for order book interaction
- Monero RPC for XMR transactions
- Base Sepolia RPC for EVM transactions

## Implementation Roadmap

### Phase 1: Core Infrastructure
- Set up project structure
- Implement 1inch Cross-Chain SDK integration
- Create basic API endpoints

### Phase 2: Swap Daemon Integration
- Develop communication layer with atomic-swap daemon
- Implement daemon control interfaces
- Create state synchronization mechanisms
- Build error handling and recovery protocols

### Phase 3: Order Management
- Implement order creation and signing
- Develop order book interaction
- Build order tracking system

### Phase 4: Relayer Functionality
- Develop order monitoring system
- Implement matching algorithm
- Create execution engine
- Connect relayer to swap daemon triggers

### Phase 5: XMR-ETH Bridge
- Integrate with Monero RPC
- Implement atomic swap coordination
- Develop recovery mechanisms
- Build cross-chain transaction monitoring

### Phase 6: Testing & Deployment
- Unit and integration testing
- End-to-end swap testing
- Security audit
- Production deployment

## API Endpoints

### Order Management
- `POST /api/orders` - Create and post a new order
- `GET /api/orders` - List all orders
- `GET /api/orders/:id` - Get order details
- `DELETE /api/orders/:id` - Cancel an order

### Swap Daemon Control
- `POST /api/swaps` - Initiate a new atomic swap
- `GET /api/swaps` - List all active swaps
- `GET /api/swaps/:id` - Get swap details and status
- `POST /api/swaps/:id/cancel` - Attempt to cancel a swap
- `GET /api/swaps/:id/proof` - Get cryptographic proofs for a swap

### Status & Monitoring
- `GET /api/status` - Get service status
- `GET /api/metrics` - Get performance metrics
- `POST /api/webhooks` - Register webhook for notifications

## Configuration

The service requires the following environment variables:

```
# Network Configuration
BASE_SEPOLIA_RPC_URL=
MONERO_RPC_URL=

# Contract Addresses
LIMIT_ORDER_PROTOCOL_ADDRESS=0xE53136D9De56672e8D2665C98653AC7b8A60Dc44
SWAP_CREATOR_ADDRESS=0xA8Eec88fC1A0096D2571a2c47aC9bF7492BfF39a
XMR_ESCROW_SRC_ADDRESS=0x3d3F34A0C3ee6940C50B50DBaa1b2150ca119Fb3

# Swap Daemon Configuration
SWAP_DAEMON_HOST=localhost
SWAP_DAEMON_PORT=5000
SWAP_DAEMON_API_KEY=
SWAP_DAEMON_SSL_ENABLED=false

# API Keys
INCH_API_KEY=

# Security
PRIVATE_KEY=
```

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## Security Considerations

- Private keys are stored securely and never exposed
- All transactions are signed locally
- Recovery mechanisms for interrupted swaps
- Timeout handling for cross-chain operations

## Future Enhancements

- Support for additional EVM chains
- Integration with more DEX aggregators
- Enhanced privacy features
- Mobile app integration
