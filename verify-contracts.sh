#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found."
    exit 1
fi

# Source the .env file
source .env

# Check if ETHERSCAN_API_KEY is set
if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "Error: ETHERSCAN_API_KEY not set in .env file."
    exit 1
fi

# Contract addresses from the deployment
SWAP_CREATOR_ADDRESS="0xE7c61B836c76DCA60FF45431FF4a555fcda6514f"
SWAP_CREATOR_ADAPTER_ADDRESS="0x1dF56ffB766cA061c0cC73410b94989429B47acb"

echo "Verifying SwapCreator contract at $SWAP_CREATOR_ADDRESS..."
forge verify-contract \
    --chain-id 84532 \
    --watch \
    --compiler-version "v0.8.28" \
    $SWAP_CREATOR_ADDRESS \
    contracts/atomic-swap/ethereum/contracts/SwapCreator.sol:SwapCreator \
    --etherscan-api-key $ETHERSCAN_API_KEY

echo "Verifying XMREscrowSrc contract at $SWAP_CREATOR_ADAPTER_ADDRESS..."
forge verify-contract \
    --chain-id 84532 \
    --watch \
    --compiler-version "v0.8.28" \
    --constructor-args $(cast abi-encode "constructor(address)" $SWAP_CREATOR_ADDRESS) \
    $SWAP_CREATOR_ADAPTER_ADDRESS \
    contracts/XMREscrowSrc.sol:XMREscrowSrc \
    --etherscan-api-key $ETHERSCAN_API_KEY

echo "Verification process completed!"
