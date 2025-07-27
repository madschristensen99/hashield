# 🛡️ Hashield: Private web3 browsing built on Monero-Ethereum atomic swaps

## 🏗️ Project Overview

To make this project I smashed together three existing projects: 

- [Hashlocked](https://ethglobal.com/showcase/hashlocked-jwaq6) – Fusion + BTC<>EVM Swaps
- [PrivacyLinks](https://ethglobal.com/showcase/privacylinks-y30gr) – Chromium web3 extension providing automatic address cycling
- [ETH-XMR Atomic Swaps](https://github.com/AthanorLabs/atomic-swap) – open-source ETH ↔ XMR swap protocol

The end result is a privacy-by-default web3 wallet browser extension. 

- **EVM Side**: Smart contracts with deterministic factory deployment and adapter pattern
- **Monero Side**: Native Monero cryptographic primitives (adapter signatures) for secure transactions
- **Atomic Guarantee**: Either both parties get their desired assets, or both get refunded

### 🔄 Supported Swap Directions

1. **EVM → XMR**: Trade ETH/ERC20 tokens for Monero
2. **XMR → EVM**: Trade Monero for ETH/ERC20 tokens

## 🧱 Technical Components

### Smart Contracts (EVM)
- `XMREscrowFactory`: Creates escrow contracts using deterministic deployment (Create2)
- `XMREscrowSrc`: Source escrow for XMR→EVM swaps
- `XMREscrowDst`: Destination escrow for EVM→XMR swaps
- `XMRSwapAdapter`: Adapter contract connecting escrows with the SwapCreator
- `SwapCreator`: Existing implementation of ETH-XMR atomic swap contract
- **Deployed on Base Sepolia**: Check deployment files for latest addresses

### Key Features
- ✅ **Modular Architecture**: Adapter pattern for easy integration and upgrades
- ✅ **1-inch Compatible**: Deposit wrapper interface for aggregator compatibility
- ✅ **Deterministic Deployment**: Create2 for predictable contract addresses
- ✅ **Privacy-Preserving**: Works with Monero's privacy features
- ✅ **Gas Optimized**: Minimal proxy pattern for efficient deployment

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js 18+
node --version

# Git
git --version
```

### Environment Setup
Create `.env` file:
```bash
# EVM Configuration
PRIVATE_KEY=your_ethereum_private_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHERSCAN_API_KEY=your_etherscan_key
BASESCAN_API_KEY=your_basescan_key

# Monero Configuration
MONERO_WALLET_RPC=http://localhost:18083/json_rpc
MONERO_DAEMON_RPC=http://localhost:18081/json_rpc
MONERO_WALLET_PASSWORD=your_wallet_password
```

### Installation
```bash
# Clone the repository
git clone https://github.com/madschristensen99/hashield/
cd hashield

# Install dependencies
npm install

# Compile contracts
cd evm
npx hardhat compile
```

## 💱 Swap Flows

### 🔵 EVM → XMR Flow

**Participants**: MAKER (provides ETH/ERC20), TAKER (provides XMR)

```bash
# 1. Deploy contracts if needed
npx hardhat run scripts/deploy-xmr.ts --network base-sepolia

# 2. MAKER creates escrow with funds
npx hardhat run scripts/create-src-escrow.ts --network base-sepolia

# 3. TAKER sends XMR to MAKER's Monero address
# (Using Monero wallet software)

# 4. MAKER verifies XMR transaction and reveals secret
npx hardhat run scripts/reveal-secret.ts --network base-sepolia

# 5. TAKER claims ETH/ERC20 using revealed secret
npx hardhat run scripts/claim-src-escrow.ts --network base-sepolia
```

### 🔴 XMR → EVM Flow

**Participants**: MAKER (provides XMR), TAKER (provides ETH/ERC20)

```bash
# 1. TAKER creates escrow with funds
npx hardhat run scripts/create-dst-escrow.ts --network base-sepolia

# 2. MAKER sends XMR to TAKER's Monero address
# (Using Monero wallet software)

# 3. MAKER provides proof of XMR payment
npx hardhat run scripts/record-xmr-tx.ts --network base-sepolia

# 4. TAKER verifies XMR transaction and releases ETH/ERC20
npx hardhat run scripts/claim-dst-escrow.ts --network base-sepolia
```

## 🔐 Cryptographic Flow

### Atomic Swap Guarantee
1. **Setup Phase**: Both parties lock assets
2. **Claim Phase**: First claimer reveals secret, second uses revealed secret
3. **Safety**: If either fails, both get refunded after timelock

## 🛡️ Security Features

### Key Protections
- **No Counterparty Risk**: Trustless execution
- **Atomic Guarantee**: Both succeed or both fail
- **Time Boundaries**: Configurable timelock periods

## 🔧 Configuration

### Timelock Settings
```javascript
timelock: {
  withdrawalPeriod: 3600,     // 1 hour until withdrawal allowed
  cancellationPeriod: 86400   // 24 hour safety period before refund
}
```

### Network Support
- **EVM**: Base Sepolia (testnet), easily extendable to mainnet and other EVM chains
- **Monero**: Stagenet, ready for mainnet


ls btc/output/htlc_*_testnet4.json
```
