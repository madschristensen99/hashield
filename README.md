# 🛡️ Hashield: Private web3 browsing built on Monero-Ethereum atomic swaps

## 🏗️ Project Overview

Hashield is a privacy-by-default web3 wallet browser extension built on Monero-Ethereum atomic swaps. It combines:

- Chromium web3 extension providing automatic address cycling for privacy
- ETH ↔ XMR atomic swap protocol for trustless cross-chain transactions
- 1inch cross-chain swap interfaces for enhanced interoperability

The end result is a privacy-focused web3 wallet that enables secure, atomic swaps between EVM chains and Monero.

- **EVM Side**: Smart contracts with deterministic factory deployment and adapter pattern
- **Monero Side**: Native Monero cryptographic primitives for secure transactions
- **Atomic Guarantee**: Either both parties get their desired assets, or both get refunded

### 🔄 Supported Swap Directions

1. **EVM → XMR**: Trade ETH/ERC20 tokens for Monero
2. **XMR → EVM**: Trade Monero for ETH/ERC20 tokens

## 🧱 Technical Components

### Smart Contracts (EVM)
- `SwapCreatorAdapter`: Adapter contract connecting with 1inch cross-chain swap interfaces
- `SwapCreator`: Implementation of ETH-XMR atomic swap contract
- **Deployed on Base Sepolia**: Check deployment files for latest addresses

### Key Features
- ✅ **Modular Architecture**: Adapter pattern for easy integration and upgrades
- ✅ **1-inch Compatible**: Interface compatibility for aggregator integration
- ✅ **Privacy-Preserving**: Works with Monero's privacy features
- ✅ **Cross-Chain**: Atomic swaps between EVM chains and Monero

## 🚀 Development Setup

### Prerequisites
```bash
# Git
git --version

# Foundry
forge --version
```

### Installation
```bash
# Clone the repository with submodules
git clone https://github.com/madschristensen99/hashield.git
cd hashield
git submodule update --init --recursive

# If you're setting up from scratch, add the required submodules:
git submodule add https://github.com/1inch/cross-chain-swap.git contracts/cross-chain-swap
git submodule add https://github.com/foundry-rs/forge-std.git lib/forge-std
git submodule add https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts

# Initialize and update submodules within cross-chain-swap
cd contracts/cross-chain-swap && git submodule init && git submodule update
cd ../..

# Initialize and update submodules within xmr-eth-atomic-swaps
cd xmr-eth-atomic-swaps && git submodule init && git submodule update
cd ..
```

### Compiling Contracts
```bash
# Compile all contracts
forge build

# Compile specific contracts
forge build --contracts contracts/SwapCreatorAdapter.sol
```

### Testing
```bash
# Run tests
forge test

# Run tests with verbosity
forge test -vvv
```

### Deployment
```bash
# Deploy to Base Sepolia
./deploy-direct.sh
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

### Network Support
- **EVM**: Base Sepolia (testnet), easily extendable to mainnet and other EVM chains
- **Monero**: Stagenet, ready for mainnet

## 📁 Project Structure

```
hashield/
├── contracts/                  # Smart contracts
│   ├── SwapCreatorAdapter.sol  # Adapter for 1inch interfaces
│   ├── atomic-swap/            # Symbolic link to xmr-eth-atomic-swaps/ethereum
│   └── cross-chain-swap/       # 1inch cross-chain-swap submodule
├── lib/                        # External libraries
│   ├── forge-std/              # Foundry standard library
│   └── openzeppelin-contracts/ # OpenZeppelin contracts
├── xmr-eth-atomic-swaps/       # Atomic swap implementation
├── extension/                  # Browser extension code
└── foundry.toml                # Foundry configuration
```
