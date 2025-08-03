#!/bin/bash

# Fresh Wallet Swap Daemon Starter
# This script starts the swap daemon with a fresh Ethereum wallet for anonymity
# It uses relayer functionality to avoid needing ETH in the fresh wallet for gas fees

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Fresh Wallet Swap Daemon Starter ===${NC}"
echo -e "${YELLOW}This script will start the swap daemon with a fresh Ethereum wallet${NC}"
echo

# Stop any existing swap daemon
echo -e "${BLUE}Stopping any existing swap daemon...${NC}"
pkill -f swapd || true
sleep 2

# Generate a timestamp for unique wallet identification
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FRESH_WALLET_PATH="$HOME/.atomicswap/stagenet/fresh_eth_${TIMESTAMP}.key"

echo -e "${YELLOW}Starting swap daemon with fresh wallet at: $FRESH_WALLET_PATH${NC}"

# Start the swap daemon with the fresh wallet
./swapd \
  --env stagenet \
  --eth-endpoint "https://sepolia.base.org" \
  --contract-address "0x633690eCe30981eABd2CE80D523Aaf43483b23Ab" \
  --monerod-host "node.monerodevs.org" \
  --monerod-port 38089 \
  --wallet-file "$HOME/.atomicswap/stagenet/wallet/swap-wallet" \
  --wallet-password "" \
  --eth-privkey "$FRESH_WALLET_PATH" \
  --log-level debug \
  --bootnodes "/ip4/86.38.205.119/tcp/9900/p2p/12D3KooWRPmWtjhncZYLrfFybLLFpc9EBjHYhsh58XuQ6CytrpoF" \
  --gas-price 1000000 \
  --gas-limit 3000000 \
  --relayer

# Note: This script now runs the swap daemon in the foreground
# so you can see all logs directly in the terminal
# Press Ctrl+C to stop the daemon
