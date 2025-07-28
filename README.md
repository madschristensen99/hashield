# 🔒 PrivateRPC

Replace any Ethereum RPC endpoint with pRPC and your MetaMask (or any EIP-1193 wallet) gains private, gas-less, atomic ETH ↔ XMR swaps while remaining fully compatible with existing dApps.

<p align="center">
  <img src="assets/logo.jpg" alt="PrivateRPC Logo">
</p>

## How it works:
Only the following four methods are intercepted and re-written; all others are forwarded verbatim to the real Base-Sepolia node.
| Method                | Interception Logic                                                    | Return Value    |
| --------------------- | --------------------------------------------------------------------- | --------------- |
| `eth_getBalance`      | Query real balance, subtract **locked ETH** in `SwapCreator`          | `real - locked` |
| `eth_sendTransaction` | If `tx.to == SwapCreatorAdapter` → **atomic swap flow**; else forward | swap tx hash    |
| `eth_call`            | If calldata is `createEscrow` → fake success; else forward            | `0x` / success  |
| `eth_estimateGas`     | If calldata is `createEscrow` → fixed 200 k gas; else forward         | `0x30d40`       |

## 🔄 1Inch Microservice

The 1Inch Microservice is a TypeScript-based bridge between the 1inch Fusion SDK and the SwapD JSON-RPC API, enabling seamless atomic swaps between ETH and XMR.

### Features

- 🔒 **Atomic Swaps**: Facilitates trustless ETH-XMR atomic swaps using the 1inch Fusion SDK and SwapCreatorAdapter contract
- 🔄 **SwapD Integration**: Communicates with the SwapD daemon via JSON-RPC for XMR operations
- 🌐 **RESTful API**: Provides a comprehensive API for creating and monitoring swaps
- 🔍 **Status Tracking**: Monitors the status of swaps across both Ethereum and Monero networks

### API Endpoints

#### 1inch Fusion Endpoints
- `POST /escrow`: Create a new escrow for an atomic swap
- `GET /predict-escrow`: Predict an escrow address without submitting a transaction
- `GET /escrow/:orderHash`: Get the status of an existing escrow

#### SwapD Endpoints
- `GET /swapd/offers`: Get all available swap offers from the network
- `POST /swapd/offers`: Create a new swap offer
- `POST /swapd/offers/:offerID/take`: Take an existing swap offer
- `GET /swapd/swaps/ongoing`: Get ongoing swaps
- `GET /swapd/swaps/past`: Get past swaps
- `GET /swapd/swaps/:id/status`: Get swap status

#### Integrated Endpoints
- `POST /integrated/swap`: Create a complete XMR-ETH atomic swap using both 1inch and SwapD
- `GET /integrated/swap/:orderHash/:swapId`: Get status of an integrated swap

### Setup

1. Navigate to the 1InchMicroservice directory
2. Create a `.env` file based on `.env.example`
3. Install dependencies: `npm install`
4. Start the service: `npm start`

The microservice requires both a running SwapD daemon and access to the Ethereum network via an RPC provider.

## 🚀 Deployed Contracts

The following contracts have been deployed to Base Sepolia testnet:

- 📝 **SwapCreator**: `0x07b9c8BF96E553Adec406cC6ab8c41CCD3d53a51`
- 🔄 **SwapCreatorAdapter**: `0x14Ab64a2f29f4921c200280988eea59c85266A33`

## 🛠️ Setup

1. 📦 Clone this repository and its submodules:
   ```shell
   git clone --recursive <repository-url>
   ```

2. 🔧 Install Foundry if you haven't already:
   ```shell
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

3. 🔑 Create a `.env` file with your private key and RPC URL:
   ```
   PRIVATE_KEY=your_private_key_here
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   ETHERSCAN_API_KEY=optional_etherscan_api_key
   ```

## 💻 Building

```shell
$ forge build
```

## 🚀 Deployment

To deploy the contracts to Base Sepolia:

```shell
$ ./deploy-direct.sh
```

This script will:
1. 💰 Deploy the SwapCreator contract
2. 🔗 Deploy the SwapCreatorAdapter contract with the SwapCreator address

Alternatively, you can use the Foundry script:

```shell
$ forge script script/DeployContracts.s.sol --rpc-url base_sepolia --broadcast
```

## 🧹 Testing

```shell
$ forge test
```
