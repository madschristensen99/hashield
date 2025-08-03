#!/bin/bash

# Set environment variables for contract addresses
export SWAP_CREATOR_ADDRESS="0x633690eCe30981eABd2CE80D523Aaf43483b23Ab"

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