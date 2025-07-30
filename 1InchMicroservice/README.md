# HashShield 1Inch Microservice

A microservice that bridges the HashShield Monero-Ethereum atomic swap protocol with the 1inch Limit Order Protocol. This service acts as a relayer for cross-chain transactions between Monero and EVM chains.

## Features

- Order creation and management with the 1inch Limit Order Protocol
- Integration with the Monero-ETH atomic swap daemon
- Relayer functionality for deploying escrows and executing swaps
- RESTful API for order management, swap control, and relayer operations

## Architecture

The microservice is structured into three main components:

1. **Order Manager**: Handles interactions with the 1inch order book
   - Create and manage limit orders
   - Fetch active orders and quotes
   - Generate secrets and hash locks for atomic swaps

2. **Swap Daemon Interface**: Communicates with the Monero-ETH atomic swap daemon
   - Create and manage swaps
   - Set swap status (ready, claim, refund)
   - Monitor swap status

3. **Relayer**: Handles blockchain transactions
   - Deploy source and destination escrows
   - Execute withdrawals and cancellations
   - Submit transactions to the Resolver contract

## Prerequisites

- Node.js 14+ and npm
- Access to Base Sepolia RPC endpoint
- 1inch API key
- Monero-ETH atomic swap daemon running
- Private key for relayer account with ETH for gas

## Setup

1. Clone the repository:
```bash
git clone https://github.com/madschristensen99/hashield.git
cd hashield/1InchMicroservice
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on the `.env.example` template:
```bash
cp .env.example .env
```

4. Fill in the required environment variables in the `.env` file:
```
# Server configuration
SERVER_HOST=localhost
SERVER_PORT=3000

# 1inch API configuration
ONEINCH_API_URL=https://fusion.1inch.io
ONEINCH_API_KEY=your_api_key_here

# Blockchain configuration
BLOCKCHAIN_RPC_URL=https://sepolia.base.org
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here

# Swap daemon configuration
SWAP_DAEMON_RPC_URL=http://localhost:8080
SWAP_DAEMON_USERNAME=username
SWAP_DAEMON_PASSWORD=password

# Relayer configuration
RELAYER_FEE=0.001
RELAYER_ADDRESS=0xYourRelayerAddress
```

5. Build the TypeScript code:
```bash
npm run build
```

6. Start the service:
```bash
npm start
```

## API Endpoints

### Order Management

- `GET /api/orders` - Get active orders
- `GET /api/orders/maker/:address` - Get orders by maker address
- `GET /api/orders/:orderId` - Get order by ID
- `POST /api/orders` - Create a new order
- `PATCH /api/orders/:orderId` - Update order status

### Swap Daemon

- `GET /api/swaps/status` - Get swap daemon status
- `GET /api/swaps` - Get all swaps
- `GET /api/swaps/:swapId` - Get swap by ID
- `POST /api/swaps` - Create a new swap
- `POST /api/swaps/:swapId/ready` - Set swap as ready
- `POST /api/swaps/:swapId/claim` - Claim a swap
- `POST /api/swaps/:swapId/refund` - Refund a swap

### Relayer

- `POST /api/relayer/escrow` - Create an escrow
- `POST /api/relayer/withdraw` - Withdraw with relayer
- `POST /api/relayer/deploy/src` - Deploy source escrow
- `POST /api/relayer/deploy/dst` - Deploy destination escrow
- `POST /api/relayer/withdraw/escrow` - Withdraw from escrow
- `POST /api/relayer/cancel/escrow` - Cancel escrow

## Smart Contract Addresses (Base Sepolia)

- LimitOrderProtocol: [`0xE53136D9De56672e8D2665C98653AC7b8A60Dc44`](https://sepolia.basescan.org/address/0xE53136D9De56672e8D2665C98653AC7b8A60Dc44)
- SwapCreator: [`0x212072CB504Dc2fBF6477772B8E318D286B80e35`](https://sepolia.basescan.org/address/0x212072CB504Dc2fBF6477772B8E318D286B80e35)
- XMREscrowSrc: [`0x8c39940feBc35F0A44868c3B3E138C58989944a1`](https://sepolia.basescan.org/address/0x8c39940feBc35F0A44868c3B3E138C58989944a1)
- XMREscrowDst: [`0xA81283f4E4FB8eDd1cF497C09ABcFa8bBe9289Ea`](https://sepolia.basescan.org/address/0xA81283f4E4FB8eDd1cF497C09ABcFa8bBe9289Ea)
- Resolver: [`0x569961856A3f66788D29e70aeaB7400f11895f4A`](https://sepolia.basescan.org/address/0x569961856A3f66788D29e70aeaB7400f11895f4A)

## Development

To run in development mode with hot reloading:

```bash
npm run dev
```

## License

MIT
