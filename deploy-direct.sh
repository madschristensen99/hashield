#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found."
    exit 1
fi

# Source the .env file
source .env

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not set in .env file."
    exit 1
fi

echo "Deploying SwapCreator..."
SWAP_CREATOR_ADDRESS=$(forge create --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --broadcast \
  contracts/atomic-swap/ethereum/contracts/SwapCreator.sol:SwapCreator \
  | grep "Deployed to" | awk '{print $3}')

if [ -z "$SWAP_CREATOR_ADDRESS" ]; then
    echo "Error: Failed to deploy SwapCreator."
    exit 1
fi

echo "SwapCreator deployed at: $SWAP_CREATOR_ADDRESS"

echo "Deploying SwapCreatorAdapter..."
forge create --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --broadcast \
  contracts/SwapCreatorAdapter.sol:SwapCreatorAdapter \
  --constructor-args $SWAP_CREATOR_ADDRESS

echo "Deployment completed!"
