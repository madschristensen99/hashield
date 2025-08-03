#!/bin/bash

# Bidirectional Atomic Swap Test Script with curl commands only
# This script performs two atomic swaps in both directions:
# 1. Local node provides ETH, Remote node provides XMR
# 2. Local node provides XMR, Remote node provides ETH

# Configuration
REMOTE_NODE="http://86.38.205.119:5000"
LOCAL_NODE="http://127.0.0.1:5000"

# Swap parameters
XMR_AMOUNT_1="0.03"  # For swap 1 (remote provides)
ETH_AMOUNT_1="0.06"  # For swap 1 (local provides)
XMR_AMOUNT_2="0.02"  # For swap 2 (local provides)
ETH_AMOUNT_2="0.04"  # For swap 2 (remote provides)
EXCHANGE_RATE="2"    # 1 XMR = 2 ETH

echo "=== Bidirectional Atomic Swap Test ==="
echo "Remote node: $REMOTE_NODE"
echo "Local node: $LOCAL_NODE"
echo

# Step 1: Check initial balances
echo "=== Checking Initial Balances ==="
echo "Local node balance:"
curl -s -X POST "$LOCAL_NODE" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":"1","method":"personal_balances","params":{}}' | jq
echo

echo "Remote node balance:"
curl -s -X POST "$REMOTE_NODE" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":"2","method":"personal_balances","params":{}}' | jq
echo

# Step 2: Direction 1 - Local node provides ETH, Remote node provides XMR
echo "=== Starting Swap 1: Local provides ETH, Remote provides XMR ==="
echo "Creating offer on remote node (providing XMR)..."
REMOTE_OFFER_RESPONSE=$(curl -s -X POST "$REMOTE_NODE" \
    -H 'Content-Type: application/json' \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": \"3\",
        \"method\": \"net_makeOffer\",
        \"params\": {
            \"provides\": \"XMR\",
            \"minAmount\": \"$XMR_AMOUNT_1\",
            \"maxAmount\": \"$XMR_AMOUNT_1\",
            \"exchangeRate\": \"$EXCHANGE_RATE\",
            \"ethAsset\": \"ETH\",
            \"useRelayer\": true
        }
    }")

echo "Remote offer response: $REMOTE_OFFER_RESPONSE"
REMOTE_PEER_ID=$(echo $REMOTE_OFFER_RESPONSE | jq -r '.result.peerID')
REMOTE_OFFER_ID=$(echo $REMOTE_OFFER_RESPONSE | jq -r '.result.offerID')

if [ "$REMOTE_PEER_ID" == "null" ] || [ "$REMOTE_OFFER_ID" == "null" ]; then
    echo "Error: Failed to create offer on remote node"
    echo "Response: $REMOTE_OFFER_RESPONSE"
    exit 1
fi

echo "Remote offer created with ID: $REMOTE_OFFER_ID"
echo "Taking offer from local node (providing ETH)..."

TAKE_RESPONSE=$(curl -s -X POST "$LOCAL_NODE" \
    -H 'Content-Type: application/json' \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": \"4\",
        \"method\": \"net_takeOffer\",
        \"params\": {
            \"peerID\": \"$REMOTE_PEER_ID\",
            \"offerID\": \"$REMOTE_OFFER_ID\",
            \"providesAmount\": \"$ETH_AMOUNT_1\"
        }
    }")

echo "Take offer response: $TAKE_RESPONSE"
echo "Swap 1 initiated. Waiting for swap to progress..."
sleep 5

# Step 3: Direction 2 - Local node provides XMR, Remote node provides ETH
echo "=== Starting Swap 2: Local provides XMR, Remote provides ETH ==="
echo "Creating offer on local node (providing XMR)..."
LOCAL_OFFER_RESPONSE=$(curl -s -X POST "$LOCAL_NODE" \
    -H 'Content-Type: application/json' \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": \"5\",
        \"method\": \"net_makeOffer\",
        \"params\": {
            \"provides\": \"XMR\",
            \"minAmount\": \"$XMR_AMOUNT_2\",
            \"maxAmount\": \"$XMR_AMOUNT_2\",
            \"exchangeRate\": \"$EXCHANGE_RATE\",
            \"ethAsset\": \"ETH\",
            \"useRelayer\": true
        }
    }")

echo "Local offer response: $LOCAL_OFFER_RESPONSE"
LOCAL_PEER_ID=$(echo $LOCAL_OFFER_RESPONSE | jq -r '.result.peerID')
LOCAL_OFFER_ID=$(echo $LOCAL_OFFER_RESPONSE | jq -r '.result.offerID')

if [ "$LOCAL_PEER_ID" == "null" ] || [ "$LOCAL_OFFER_ID" == "null" ]; then
    echo "Error: Failed to create offer on local node"
    echo "Response: $LOCAL_OFFER_RESPONSE"
    exit 1
fi

echo "Local offer created with ID: $LOCAL_OFFER_ID"
echo "Taking offer from remote node (providing ETH)..."

TAKE_RESPONSE=$(curl -s -X POST "$REMOTE_NODE" \
    -H 'Content-Type: application/json' \
    -d "{
        \"jsonrpc\": \"2.0\",
        \"id\": \"6\",
        \"method\": \"net_takeOffer\",
        \"params\": {
            \"peerID\": \"$LOCAL_PEER_ID\",
            \"offerID\": \"$LOCAL_OFFER_ID\",
            \"providesAmount\": \"$ETH_AMOUNT_2\"
        }
    }")

echo "Take offer response: $TAKE_RESPONSE"
echo "Swap 2 initiated."
sleep 5

# Step 4: Check ongoing swaps
echo "=== Checking Ongoing Swaps ==="
echo "Local node ongoing swaps:"
curl -s -X POST "$LOCAL_NODE" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":"7","method":"swap_getOngoing","params":{}}' | jq
echo

echo "Remote node ongoing swaps:"
curl -s -X POST "$REMOTE_NODE" \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":"8","method":"swap_getOngoing","params":{}}' | jq
echo

echo "=== Bidirectional swap test completed ==="
echo "You can monitor swap progress with:"
echo "curl -s -X POST \"$LOCAL_NODE\" -H 'Content-Type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"method\":\"swap_getOngoing\",\"params\":{}}' | jq"