const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

// Base URL for the API
const API_URL = 'http://localhost:3000';

// Example order data for a Monero swap using Base Sepolia token addresses
const orderData = {
  // We'll let the service generate a random salt
  // maker will be derived from the private key
  makerAsset: '0x0000000000000000000000000000000000000000',  // Native ETH
  takerAsset: '0x0000000000000000000000000000000000000000',  // Native ETH
  makingAmount: '10000000000000000',  // 0.01 ETH
  takingAmount: '5000000000000000',  // 0.005 ETH
  makerTraits: '0',
  isMoneroSwap: true,
  value: '0.01', // Send 0.01 ETH with the transaction
  xmrAddress: '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A',
  simulateOnly: true, // Only simulate, don't submit transaction
  logParams: true // Log detailed parameters for debugging
};

// Test the health endpoint
async function testHealth() {
  try {
    console.log('Testing health endpoint...');
    const response = await axios.get(`${API_URL}/health`);
    console.log('Health check response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test the place-order endpoint with direct transaction submission
async function testPlaceOrder() {
  try {
    // Step 1: Submit the order directly
    console.log('Step 1: Submitting order directly to the blockchain...');
    const orderSubmitData = { ...orderData };
    
    console.log('Order data:', JSON.stringify(orderSubmitData, null, 2));
    
    const orderResponse = await axios.post(`${API_URL}/place-order`, orderSubmitData);
    console.log('Order response:', JSON.stringify(orderResponse.data, null, 2));
    
    if (!orderResponse.data.success) {
      console.error('Order submission failed:', orderResponse.data.error);
      return;
    }
    
    console.log('Order submission successful!');
    console.log('==========================================================');
    
    if (orderResponse.data.moneroData) {
      console.log('Monero swap data:', orderResponse.data.moneroData);
    }
    
    return orderResponse.data;
  } catch (error) {
    console.error('Order placement failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function runTests() {
  try {
    console.log('Starting tests for HashShield 1InchMicroservice orderPlacer...');
    console.log('==========================================================');
    
    // First test the health endpoint
    await testHealth();
    console.log('==========================================================');
    
    // Then test the place-order endpoint with Monero swap
    await testPlaceOrder();
    console.log('==========================================================');
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Tests failed with error:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
