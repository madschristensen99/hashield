const express = require('express');
const limitOrderProtocol = require('./limitOrderProtocol');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/place-order', async (req, res) => {
  try {
    console.log(`Processing ${req.body.simulateOnly ? 'simulation' : 'order placement'} request`);
    
    // Validate required fields
    if (!req.body.makerAsset || !req.body.takerAsset || !req.body.makingAmount || !req.body.takingAmount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required order parameters. Required: makerAsset, takerAsset, makingAmount, takingAmount' 
      });
    }
    
    // Process the order
    const result = await limitOrderProtocol.placeOrder(req.body);
    
    // Handle simulation results differently
    if (req.body.simulateOnly) {
      return res.json(result); // Return simulation results directly
    }
    
    // Return success response for actual order placement
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.reason || 'See server logs for more details'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Order Placer service running on port ${PORT}`);
});
