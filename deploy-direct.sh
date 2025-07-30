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

# Get the deployer's address from the private key
DEPLOYER_ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)
echo "Deployer address: $DEPLOYER_ADDRESS"

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

echo "Deploying XMREscrowSrc..."
ADAPTER_ADDRESS=$(forge create contracts/XMREscrowSrc.sol:XMREscrowSrc \
  --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  --skip cross-chain-swap \
  --via-ir \
  --constructor-args $SWAP_CREATOR_ADDRESS \
  | grep "Deployed to" | awk '{print $3}')

if [ -z "$ADAPTER_ADDRESS" ]; then
    echo "Error: Failed to deploy XMREscrowSrc."
    exit 1
fi

echo "XMREscrowSrc deployed at: $ADAPTER_ADDRESS"

# Verify XMREscrowSrc if API key is available
if [ "$VERIFY" = "true" ]; then
    echo "Verifying XMREscrowSrc contract..."
    forge verify-contract \
      --chain-id 84532 \
      --watch \
      --compiler-version "v0.8.28+commit.8e01d1e4" \
      --num-of-optimizations 200 \
      --constructor-args $(cast abi-encode "constructor(address)" $SWAP_CREATOR_ADDRESS) \
      --via-ir \
      $ADAPTER_ADDRESS \
      contracts/XMREscrowSrc.sol:XMREscrowSrc \
      --etherscan-api-key $ETHERSCAN_API_KEY
    
    echo "Verification submitted. Check BaseScan for status."
fi

# Deploy XMREscrowDst contract
echo "Deploying XMREscrowDst..."
DST_ADDRESS=$(forge create contracts/XMREscrowDst.sol:XMREscrowDst \
  --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  --skip cross-chain-swap \
  --via-ir \
  --constructor-args $SWAP_CREATOR_ADDRESS \
  | grep "Deployed to" | awk '{print $3}')

if [ -z "$DST_ADDRESS" ]; then
    echo "Error: Failed to deploy XMREscrowDst."
    exit 1
fi

echo "XMREscrowDst deployed at: $DST_ADDRESS"

# Verify XMREscrowDst if API key is available
if [ "$VERIFY" = "true" ]; then
    echo "Verifying XMREscrowDst contract..."
    forge verify-contract \
      --chain-id 84532 \
      --watch \
      --compiler-version "v0.8.28+commit.8e01d1e4" \
      --num-of-optimizations 200 \
      --constructor-args $(cast abi-encode "constructor(address)" $SWAP_CREATOR_ADDRESS) \
      --via-ir \
      $DST_ADDRESS \
      contracts/XMREscrowDst.sol:XMREscrowDst \
      --etherscan-api-key $ETHERSCAN_API_KEY
    
    echo "Verification submitted. Check BaseScan for status."
fi

# Get the LimitOrderProtocol address from the environment variable or use a default
LOP_ADDRESS=${LOP_ADDRESS:-"0xE53136D9De56672e8D2665C98653AC7b8A60Dc44"}

# Deploy Resolver contract
echo "Deploying Resolver..."
RESOLVER_ADDRESS=$(forge create contracts/Resolver.sol:Resolver \
  --rpc-url base_sepolia \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast \
  --skip cross-chain-swap \
  --via-ir \
  --constructor-args $ADAPTER_ADDRESS $LOP_ADDRESS $DEPLOYER_ADDRESS \
  | grep "Deployed to" | awk '{print $3}')

if [ -z "$RESOLVER_ADDRESS" ]; then
    echo "Error: Failed to deploy Resolver."
    exit 1
fi

echo "Resolver deployed at: $RESOLVER_ADDRESS"

# Verify Resolver if API key is available
if [ "$VERIFY" = "true" ]; then
    echo "Verifying Resolver contract..."
    forge verify-contract \
      --chain-id 84532 \
      --watch \
      --compiler-version "v0.8.28+commit.8e01d1e4" \
      --num-of-optimizations 200 \
      --constructor-args $(cast abi-encode "constructor(address,address,address)" $ADAPTER_ADDRESS $LOP_ADDRESS $DEPLOYER_ADDRESS) \
      --via-ir \
      $RESOLVER_ADDRESS \
      contracts/Resolver.sol:Resolver \
      --etherscan-api-key $ETHERSCAN_API_KEY
    
    echo "Verification submitted. Check BaseScan for status."
fi

echo "Deployment completed!"
echo "SwapCreator: $SWAP_CREATOR_ADDRESS"
echo "XMREscrowSrc: $ADAPTER_ADDRESS"
echo "XMREscrowDst: $DST_ADDRESS"
echo "Resolver: $RESOLVER_ADDRESS"
echo "View on BaseScan: https://sepolia.basescan.org/address/$RESOLVER_ADDRESS"
