# 🔒 PrivateRPC

Replace any Ethereum RPC endpoint with pRPC and your MetaMask (or any EIP-1193 wallet) gains private, gas-less, atomic ETH ↔ XMR swaps while remaining fully compatible with existing dApps.

<p align="center">
  <img src="assets/logo.jpg" alt="PrivateRPC Logo">
</p>

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
