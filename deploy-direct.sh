#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found."
    exit 1
fi

# Source the .env file
source .env

# Check if required environment variables are set
if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not set in .env file."
    exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "Warning: ETHERSCAN_API_KEY not set in .env file. Contract verification will be skipped."
    VERIFY="false"
else
    VERIFY="true"
fi

echo "Deploying SwapCreator..."
SWAP_CREATOR_ADDRESS=$(forge create contracts/atomic-swap/ethereum/contracts/SwapCreator.sol:SwapCreator \
  --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  --skip cross-chain-swap \
  | grep "Deployed to" | awk '{print $3}')

if [ -z "$SWAP_CREATOR_ADDRESS" ]; then
    echo "Error: Failed to deploy SwapCreator."
    exit 1
fi

echo "SwapCreator deployed at: $SWAP_CREATOR_ADDRESS"

# Verify SwapCreator if API key is available
if [ "$VERIFY" = "true" ]; then
    echo "Verifying SwapCreator contract..."
    forge verify-contract \
      --chain-id 84532 \
      --watch \
      --compiler-version "v0.8.28+commit.8e01d1e4" \
      --num-of-optimizations 200 \
      $SWAP_CREATOR_ADDRESS \
      contracts/atomic-swap/ethereum/contracts/SwapCreator.sol:SwapCreator \
      --etherscan-api-key $ETHERSCAN_API_KEY
    
    echo "Verification submitted. Check BaseScan for status."
fi

echo "Deploying SwapCreatorAdapter..."
ADAPTER_ADDRESS=$(forge create contracts/SwapCreatorAdapter.sol:SwapCreatorAdapter \
  --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  --skip cross-chain-swap \
  --via-ir \
  --constructor-args $SWAP_CREATOR_ADDRESS \
  | grep "Deployed to" | awk '{print $3}')

if [ -z "$ADAPTER_ADDRESS" ]; then
    echo "Error: Failed to deploy SwapCreatorAdapter."
    exit 1
fi

echo "SwapCreatorAdapter deployed at: $ADAPTER_ADDRESS"

# Verify SwapCreatorAdapter if API key is available
if [ "$VERIFY" = "true" ]; then
    echo "Verifying SwapCreatorAdapter contract..."
    forge verify-contract \
      --chain-id 84532 \
      --watch \
      --compiler-version "v0.8.28+commit.8e01d1e4" \
      --num-of-optimizations 200 \
      --constructor-args $(cast abi-encode "constructor(address)" $SWAP_CREATOR_ADDRESS) \
      --via-ir \
      $ADAPTER_ADDRESS \
      contracts/SwapCreatorAdapter.sol:SwapCreatorAdapter \
      --etherscan-api-key $ETHERSCAN_API_KEY
    
    echo "Verification submitted. Check BaseScan for status."
fi

echo "Deployment completed!"
echo "SwapCreator: $SWAP_CREATOR_ADDRESS"
echo "SwapCreatorAdapter: $ADAPTER_ADDRESS"
echo "View on BaseScan: https://sepolia.basescan.org/address/$ADAPTER_ADDRESS"
