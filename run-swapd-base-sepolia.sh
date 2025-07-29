#!/bin/bash

# Set environment variables for contract addresses
export SWAP_CREATOR_ADDRESS="0x1182005572533c41284Fd66baF5952133bF4d7a9"
export ESCROW_FACTORY_ADDRESS="0x23fd58d76133aa74176Ec3f282576f42E6e30eb6"
export ESCROW_ADAPTER_ADDRESS="0x29E74fba1F96d9b88DB9B8FB491043bc4CffC315"

# Build the swapd binary
echo "Building swapd binary..."
cd "$(dirname "$0")/xmr-eth-atomic-swaps"
go build -o ../swapd ./cmd/swapd
cd ..

# Ensure wallet directory exists
echo "Ensuring wallet directory exists..."
mkdir -p "$HOME/.atomicswap/stagenet/wallet"

# Run swapd with the specified parameters
echo "Running swapd on Base Sepolia with escrow integration..."
echo "Using SWAP_CREATOR_ADDRESS: $SWAP_CREATOR_ADDRESS"
echo "Using ESCROW_FACTORY_ADDRESS: $ESCROW_FACTORY_ADDRESS"
echo "Using ESCROW_ADAPTER_ADDRESS: $ESCROW_ADAPTER_ADDRESS"

./swapd \
  --env stagenet \
  --eth-endpoint "https://sepolia.base.org" \
  --contract-address "$SWAP_CREATOR_ADDRESS" \
  --monerod-host "node.monerodevs.org" \
  --monerod-port 38089 \
  --wallet-file "$HOME/.atomicswap/stagenet/wallet/swap-wallet" \
  --wallet-password "" \
  --log-level debug \
  --bootnodes "/ip4/86.38.205.119/tcp/9900/p2p/12D3KooWRPmWtjhncZYLrfFybLLFpc9EBjHYhsh58XuQ6CytrpoF"

# ./bin/swapd --env stagenet --eth-endpoint https://sepolia.base.org --monerod-host node.monerodevs.org --monerod-port 38089 --bootnodes /ip4/86.38.205.119/tcp/9900/p2p/12D3KooWRPmWtjhncZYLrfFybLLFpc9EBjHYhsh58XuQ6CytrpoF