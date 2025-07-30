#!/bin/bash

# End-to-end testing script for HashShield 1Inch Microservice
# This script tests the complete flow from order creation to swap execution

# Set up colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MICROSERVICE_URL="http://localhost:3000"
SWAP_DAEMON_URL="http://localhost:8080"

# Test parameters - adjust these as needed
SRC_CHAIN_ID=84532  # Base Sepolia
DST_CHAIN_ID=0      # Monero (represented as 0)
SRC_TOKEN_ADDRESS="0x4200000000000000000000000000000000000006"  # WETH on Base Sepolia
DST_TOKEN_ADDRESS="XMR"  # Monero
AMOUNT="0.01"  # Amount in ETH
WALLET_ADDRESS="0x$(cat .env | grep PRIVATE_KEY | cut -d '=' -f2 | xargs cast wallet address --private-key)"
XMR_ADDRESS="5BqjDM3XxPRmjhSCLEJR8PV3U4JaBXPPpJjUcCJdjYkPPuKtg6A9QJZNrJDSXYv9BKgPVm4PAqiMSGh8qcU6RsLa3HwHXXo"

echo -e "${YELLOW}HashShield 1Inch Microservice End-to-End Test${NC}"
echo "=================================================="
echo -e "${YELLOW}Testing with the following parameters:${NC}"
echo "Source Chain: Base Sepolia (${SRC_CHAIN_ID})"
echo "Destination Chain: Monero (${DST_CHAIN_ID})"
echo "Source Token: WETH (${SRC_TOKEN_ADDRESS})"
echo "Amount: ${AMOUNT} ETH"
echo "Wallet Address: ${WALLET_ADDRESS}"
echo "XMR Address: ${XMR_ADDRESS}"
echo "=================================================="

# Check if the microservice is running
echo -e "${YELLOW}Checking if the microservice is running...${NC}"
if ! curl -s "${MICROSERVICE_URL}/api/health" > /dev/null; then
  echo -e "${RED}Error: Microservice is not running at ${MICROSERVICE_URL}${NC}"
  echo "Please start the microservice with 'cd 1InchMicroservice && npm start'"
  exit 1
fi
echo -e "${GREEN}Microservice is running!${NC}"

# Check if the swap daemon is running
echo -e "${YELLOW}Checking if the swap daemon is running...${NC}"
# Using the new personal_balances endpoint through the microservice
SWAP_STATUS_RESPONSE=$(curl -s "${MICROSERVICE_URL}/api/swaps/status")
if [[ $? -ne 0 || $(echo "$SWAP_STATUS_RESPONSE" | grep -c "error") -gt 0 ]]; then
  echo -e "${RED}Error: Swap daemon is not accessible through the microservice${NC}"
  echo "Please make sure the swap daemon is running and properly configured in the microservice"
  echo "Response: $SWAP_STATUS_RESPONSE"
  exit 1
fi
echo -e "${GREEN}Swap daemon is accessible!${NC}"

# Display the balances from the swap daemon
echo -e "${YELLOW}Current balances from swap daemon:${NC}"
echo "$SWAP_STATUS_RESPONSE" | jq '.'

# Check network addresses
echo -e "${YELLOW}Getting network addresses from swap daemon...${NC}"
NET_ADDRESSES_RESPONSE=$(curl -s "${MICROSERVICE_URL}/api/swaps/network/addresses")
echo -e "${GREEN}Network addresses:${NC}"
echo "$NET_ADDRESSES_RESPONSE" | jq '.'


# Step 1: Create an order
echo -e "${YELLOW}Step 1: Creating a new order...${NC}"
ORDER_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "srcChainId": '"$SRC_CHAIN_ID"',
    "dstChainId": '"$DST_CHAIN_ID"',
    "srcTokenAddress": "'"$SRC_TOKEN_ADDRESS"'",
    "dstTokenAddress": "'"$DST_TOKEN_ADDRESS"'",
    "amount": "'"$AMOUNT"'",
    "walletAddress": "'"$WALLET_ADDRESS"'",
    "xmrAddress": "'"$XMR_ADDRESS"'"
  }')

# Check if order creation was successful
if echo "$ORDER_RESPONSE" | grep -q "success\":true"; then
  ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"orderId":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}Order created successfully with ID: ${ORDER_ID}${NC}"
else
  echo -e "${RED}Error creating order:${NC}"
  echo "$ORDER_RESPONSE" | jq '.'
  exit 1
fi

# Step 2: Retrieve order details to get secret hashes
echo -e "${YELLOW}Step 2: Retrieving order details...${NC}"
ORDER_DETAILS_RESPONSE=$(curl -s -X GET "${MICROSERVICE_URL}/api/orders/${ORDER_ID}")

# Extract the necessary information from the order details
CLAIM_SECRET_HASH=$(echo "$ORDER_DETAILS_RESPONSE" | grep -o '"claimSecretHash":"[^"]*' | cut -d'"' -f4)
REFUND_SECRET_HASH=$(echo "$ORDER_DETAILS_RESPONSE" | grep -o '"refundSecretHash":"[^"]*' | cut -d'"' -f4)
CLAIM_SECRET=$(echo "$ORDER_DETAILS_RESPONSE" | grep -o '"claimSecret":"[^"]*' | cut -d'"' -f4)
REFUND_SECRET=$(echo "$ORDER_DETAILS_RESPONSE" | grep -o '"refundSecret":"[^"]*' | cut -d'"' -f4)

echo -e "${GREEN}Retrieved order details:${NC}"
echo "Claim Secret Hash: ${CLAIM_SECRET_HASH}"
echo "Refund Secret Hash: ${REFUND_SECRET_HASH}"

# Step 3: Create a swap in the swap daemon using the new API
echo -e "${YELLOW}Step 3: Creating a swap in the swap daemon...${NC}"

# First, get the suggested exchange rate
echo -e "${YELLOW}Getting suggested exchange rate...${NC}"
EXCHANGE_RATE_RESPONSE=$(curl -s "${MICROSERVICE_URL}/api/swaps/exchange-rate")
EXCHANGE_RATE=$(echo "$EXCHANGE_RATE_RESPONSE" | jq -r '.exchangeRate')
echo -e "${GREEN}Suggested exchange rate: ${EXCHANGE_RATE}${NC}"

# Create a swap offer
echo -e "${YELLOW}Creating a swap offer...${NC}"
OFFER_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/swaps/offer" \
  -H "Content-Type: application/json" \
  -d '{
    "minAmount": "'"$AMOUNT"'",
    "maxAmount": "'"$AMOUNT"'",
    "exchangeRate": "'"$EXCHANGE_RATE"'",
    "ethAsset": "ETH",
    "orderId": "'"$ORDER_ID"'"
  }')

# Check if offer creation was successful
if [[ $? -eq 0 && $(echo "$OFFER_RESPONSE" | grep -c "error") -eq 0 ]]; then
  OFFER_ID=$(echo "$OFFER_RESPONSE" | jq -r '.offerID')
  PEER_ID=$(echo "$OFFER_RESPONSE" | jq -r '.peerID')
  echo -e "${GREEN}Swap offer created successfully with ID: ${OFFER_ID}${NC}"
  echo -e "${GREEN}Peer ID: ${PEER_ID}${NC}"
else
  echo -e "${RED}Error creating swap offer:${NC}"
  echo "$OFFER_RESPONSE" | jq '.'
  exit 1
fi

# Calculate ETH amount based on exchange rate
ETH_AMOUNT=$(echo "$AMOUNT * $EXCHANGE_RATE" | bc)
echo -e "${YELLOW}Calculated ETH amount: ${ETH_AMOUNT}${NC}"

# Take the offer (simulating another party taking our offer)
echo -e "${YELLOW}Taking the swap offer...${NC}"
TAKE_OFFER_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/swaps/take-offer" \
  -H "Content-Type: application/json" \
  -d '{
    "peerID": "'"$PEER_ID"'",
    "offerID": "'"$OFFER_ID"'",
    "providesAmount": "'"$ETH_AMOUNT"'"
  }')

# Check if taking the offer was successful
if [[ $? -eq 0 && $(echo "$TAKE_OFFER_RESPONSE" | grep -c "error") -eq 0 ]]; then
  echo -e "${GREEN}Swap offer taken successfully${NC}"
  # Use the offer ID as the swap ID for compatibility with the rest of the script
  SWAP_ID=$OFFER_ID
else
  echo -e "${RED}Error taking swap offer:${NC}"
  echo "$TAKE_OFFER_RESPONSE" | jq '.'
  exit 1
fi

# For backward compatibility with the rest of the script
# Create a swap in the swap daemon using the legacy endpoint
echo -e "${YELLOW}Creating a swap in the swap daemon (legacy method)...${NC}"
SWAP_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/swaps" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "'"$ORDER_ID"'",
    "ethAddress": "'"$WALLET_ADDRESS"'",
    "xmrAddress": "'"$XMR_ADDRESS"'",
    "amount": "'"$AMOUNT"'"
  }')

# Check if swap creation was successful
if echo "$SWAP_RESPONSE" | grep -q "success\":true"; then
  SWAP_ID_LEGACY=$(echo "$SWAP_RESPONSE" | grep -o '"swapId":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}Swap also created via legacy method with ID: ${SWAP_ID_LEGACY}${NC}"
else
  echo -e "${YELLOW}Note: Legacy swap creation method returned:${NC}"
  echo "$SWAP_RESPONSE" | jq '.'
  # Don't exit, as we already have a swap from the new method
fi

# Step 4: Generate a nonce for the escrow
NONCE=$(date +%s)
echo -e "${YELLOW}Step 4: Generated nonce: ${NONCE}${NC}"

# Step 5: Deploy source escrow
echo -e "${YELLOW}Step 5: Deploying source escrow...${NC}"
SRC_ESCROW_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/relayer/deploy/src" \
  -H "Content-Type: application/json" \
  -d '{
    "immutables": {
      "swapCreator": "0x212072CB504Dc2fBF6477772B8E318D286B80e35",
      "claimSecretHash": "'"$CLAIM_SECRET_HASH"'",
      "refundSecretHash": "'"$REFUND_SECRET_HASH"'"
    },
    "order": {
      "maker": "'"$WALLET_ADDRESS"'",
      "tokenIn": "'"$SRC_TOKEN_ADDRESS"'",
      "tokenOut": "'"$DST_TOKEN_ADDRESS"'",
      "amountIn": "'"$(echo "$AMOUNT" | awk '{print $1 * 10^18}')"'",
      "amountOut": "'"$(echo "$AMOUNT" | awk '{print $1 * 10^12}')"'",
      "receiver": "'"$XMR_ADDRESS"'"
    },
    "r": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "vs": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "amount": "'"$(echo "$AMOUNT" | awk '{print $1 * 10^18}')"'",
    "takerTraits": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "args": "0x0000000000000000000000000000000000000000000000000000000000000000"
  }')

# Check if source escrow deployment was successful
if echo "$SRC_ESCROW_RESPONSE" | grep -q "success\":true"; then
  SRC_TX_HASH=$(echo "$SRC_ESCROW_RESPONSE" | grep -o '"transactionHash":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}Source escrow deployed successfully with transaction hash: ${SRC_TX_HASH}${NC}"
else
  echo -e "${RED}Error deploying source escrow:${NC}"
  echo "$SRC_ESCROW_RESPONSE" | jq '.'
  exit 1
fi

# Step 6: Deploy destination escrow
echo -e "${YELLOW}Step 6: Deploying destination escrow...${NC}"
DST_ESCROW_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/relayer/deploy/dst" \
  -H "Content-Type: application/json" \
  -d '{
    "dstImmutables": {
      "swapCreator": "0x212072CB504Dc2fBF6477772B8E318D286B80e35",
      "claimSecretHash": "'"$CLAIM_SECRET_HASH"'",
      "refundSecretHash": "'"$REFUND_SECRET_HASH"'"
    },
    "srcCancellationTimestamp": '"$(( $(date +%s) + 86400 ))"'
  }')

# Check if destination escrow deployment was successful
if echo "$DST_ESCROW_RESPONSE" | grep -q "success\":true"; then
  DST_TX_HASH=$(echo "$DST_ESCROW_RESPONSE" | grep -o '"transactionHash":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}Destination escrow deployed successfully with transaction hash: ${DST_TX_HASH}${NC}"
else
  echo -e "${RED}Error deploying destination escrow:${NC}"
  echo "$DST_ESCROW_RESPONSE" | jq '.'
  exit 1
fi

# Step 7: Check the swap status using the new API
echo -e "${YELLOW}Step 7: Checking swap status via new API...${NC}"
SWAP_STATUS_RESPONSE=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/status/${SWAP_ID}")

# Display the swap status
echo -e "${GREEN}Current swap status:${NC}"
echo "$SWAP_STATUS_RESPONSE" | jq '.'

# For backward compatibility, also mark the swap as ready using the legacy API
echo -e "${YELLOW}Marking swap as ready (legacy method)...${NC}"
READY_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/swaps/${SWAP_ID}/ready" \
  -H "Content-Type: application/json" \
  -d '{}')

# Check if marking swap as ready was successful
if echo "$READY_RESPONSE" | grep -q "success\":true"; then
  echo -e "${GREEN}Swap marked as ready successfully (legacy method)${NC}"
else
  echo -e "${YELLOW}Note: Legacy ready method returned:${NC}"
  echo "$READY_RESPONSE" | jq '.'
  # Don't exit, as we're using the new API primarily
fi

# Step 8: Get ongoing swaps from the daemon
echo -e "${YELLOW}Step 8: Getting ongoing swaps from the daemon...${NC}"
ONGOING_SWAPS_RESPONSE=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/ongoing")

echo -e "${GREEN}Ongoing swaps:${NC}"
echo "$ONGOING_SWAPS_RESPONSE" | jq '.'

# Wait for a moment to simulate the swap processing
echo "Waiting for 10 seconds to simulate swap processing..."
sleep 10

# Step 9: Check swap status again
echo -e "${YELLOW}Step 9: Checking swap status again...${NC}"
SWAP_STATUS_RESPONSE=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/status/${SWAP_ID}")

echo -e "${GREEN}Updated swap status:${NC}"
echo "$SWAP_STATUS_RESPONSE" | jq '.'

# Step 10: In the new API, claiming happens automatically by the daemon
# However, we'll try the legacy claim method for completeness
echo -e "${YELLOW}Step 10: Attempting to claim the swap (legacy method)...${NC}"
echo -e "${YELLOW}Note: In the new API, claiming happens automatically by the daemon${NC}"
CLAIM_RESPONSE=$(curl -s -X POST "${MICROSERVICE_URL}/api/swaps/${SWAP_ID}/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "'"$CLAIM_SECRET"'"
  }')

# Check if claiming was successful
if echo "$CLAIM_RESPONSE" | grep -q "success\":true"; then
  echo -e "${GREEN}Swap claimed successfully (legacy method)${NC}"
else
  echo -e "${YELLOW}Note: Legacy claim method returned (expected in new API):${NC}"
  echo "$CLAIM_RESPONSE" | jq '.'
fi

# Step 11: Update order status to completed
echo -e "${YELLOW}Step 11: Updating order status to completed...${NC}"
UPDATE_RESPONSE=$(curl -s -X PATCH "${MICROSERVICE_URL}/api/orders/${ORDER_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED"
  }')

# Check if update was successful
if echo "$UPDATE_RESPONSE" | grep -q "success\":true"; then
  echo -e "${GREEN}Order status updated successfully${NC}"
else
  echo -e "${RED}Error updating order status:${NC}"
  echo "$UPDATE_RESPONSE" | jq '.'
fi

# Final status check using both new and legacy APIs
echo -e "${YELLOW}Final status check...${NC}"

# Check order status (unchanged)
FINAL_ORDER_RESPONSE=$(curl -s -X GET "${MICROSERVICE_URL}/api/orders/${ORDER_ID}")
echo -e "${GREEN}Final order status:${NC}"
echo "$FINAL_ORDER_RESPONSE" | jq '.'

# Check swap status using new API
echo -e "${YELLOW}Checking final swap status using new API...${NC}"
FINAL_SWAP_STATUS=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/status/${SWAP_ID}")
echo -e "${GREEN}Final swap status (new API):${NC}"
echo "$FINAL_SWAP_STATUS" | jq '.'

# Check ongoing swaps
echo -e "${YELLOW}Checking ongoing swaps...${NC}"
FINAL_ONGOING_SWAPS=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/ongoing")
echo -e "${GREEN}Final ongoing swaps:${NC}"
echo "$FINAL_ONGOING_SWAPS" | jq '.'

# Check past swaps
echo -e "${YELLOW}Checking past swaps...${NC}"
FINAL_PAST_SWAPS=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/past")
echo -e "${GREEN}Final past swaps:${NC}"
echo "$FINAL_PAST_SWAPS" | jq '.'

# Also check using legacy API for comparison
echo -e "${YELLOW}Checking swap status using legacy API...${NC}"
FINAL_SWAP_RESPONSE=$(curl -s -X GET "${MICROSERVICE_URL}/api/swaps/${SWAP_ID}")
echo -e "${GREEN}Final swap status (legacy API):${NC}"
echo "$FINAL_SWAP_RESPONSE" | jq '.'

echo -e "${GREEN}End-to-end test completed!${NC}"
echo "=================================================="
echo -e "${YELLOW}Note: This test script has been updated to use the new SwapDaemonService JSON-RPC API methods.${NC}"
echo -e "${YELLOW}The script maintains backward compatibility with the legacy endpoints for comparison.${NC}"
echo "=================================================="
echo "Note: In a real environment, some steps would be handled automatically by the microservice and swap daemon."
echo "This script simulates the complete flow but may not represent the exact production behavior."
