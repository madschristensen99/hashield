import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();

import express from 'express';
import cors from 'cors';
import config from '../config/default';
import logger from './common/logger';
import orderController from './orderManager/orderController';
import swapController from './swapDaemon/swapController';
import relayerController from './relayer/relayerController';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Order management routes
app.get('/api/orders', orderController.getActiveOrders.bind(orderController));
app.get('/api/orders/maker/:address', orderController.getOrdersByMaker.bind(orderController));
app.get('/api/orders/:orderId', orderController.getOrderById.bind(orderController));
app.post('/api/orders', orderController.createOrder.bind(orderController));
app.patch('/api/orders/:orderId', orderController.updateOrderStatus.bind(orderController));

// Swap daemon routes
app.get('/api/swaps/status', swapController.getStatus.bind(swapController));
app.get('/api/swaps', swapController.getAllSwaps.bind(swapController));
app.get('/api/swaps/:swapId', swapController.getSwap.bind(swapController));
app.post('/api/swaps', swapController.createSwap.bind(swapController));
app.post('/api/swaps/:swapId/ready', swapController.setSwapReady.bind(swapController));
app.post('/api/swaps/:swapId/claim', swapController.claimSwap.bind(swapController));
app.post('/api/swaps/:swapId/refund', swapController.refundSwap.bind(swapController));

// Relayer routes
app.post('/api/relayer/escrow', relayerController.createEscrow.bind(relayerController));
app.post('/api/relayer/withdraw', relayerController.withdrawWithRelayer.bind(relayerController));
app.post('/api/relayer/deploy/src', relayerController.deploySrcEscrow.bind(relayerController));
app.post('/api/relayer/deploy/dst', relayerController.deployDstEscrow.bind(relayerController));
app.post('/api/relayer/withdraw/escrow', relayerController.withdrawFromEscrow.bind(relayerController));
app.post('/api/relayer/cancel/escrow', relayerController.cancelEscrow.bind(relayerController));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start the server
const PORT = parseInt(config.server.port.toString());
const HOST = config.server.host;

app.listen(PORT, HOST, () => {
  logger.info(`Server running at http://${HOST}:${PORT}`);
});

export default app;
