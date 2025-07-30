import { Request, Response } from 'express';
import swapDaemonService from './swapDaemonService';
import orderRepository from '../orderManager/orderRepository';
import logger from '../common/logger';
import { ethers } from 'ethers';

export class SwapController {
  async getStatus(req: Request, res: Response) {
    try {
      // Use personal_balances for status check in the new API
      const status = await swapDaemonService.getStatus();
      return res.status(200).json({ success: true, data: status });
    } catch (error) {
      logger.error('Error retrieving swap daemon status', { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve swap daemon status' });
    }
  }
  
  async getNetworkAddresses(req: Request, res: Response) {
    try {
      const addresses = await swapDaemonService.getNetworkAddresses();
      return res.status(200).json({ success: true, data: addresses });
    } catch (error) {
      logger.error('Error retrieving network addresses', { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve network addresses' });
    }
  }
  
  async getExchangeRate(req: Request, res: Response) {
    try {
      // In a real implementation, this would fetch from an oracle or price feed
      // For testing, we'll return a fixed exchange rate
      const exchangeRate = "10.0"; // 1 XMR = 10 ETH
      return res.status(200).json({ success: true, exchangeRate });
    } catch (error) {
      logger.error('Error retrieving exchange rate', { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve exchange rate' });
    }
  }

  async createSwap(req: Request, res: Response) {
    try {
      const { orderId, ethAddress, xmrAddress, amount } = req.body;
      
      // Validate required parameters
      if (!orderId || !ethAddress || !xmrAddress || !amount) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Validate Ethereum address
      if (!ethers.utils.isAddress(ethAddress)) {
        return res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      }
      
      // Get the order details to retrieve the secret hashes
      const order = await orderRepository.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      // Create the swap in the daemon
      const swap = await swapDaemonService.createSwap(
        ethAddress,
        xmrAddress,
        amount,
        order.claimSecretHash || '',
        order.refundSecretHash || ''
      );
      
      // Update the order with the swap ID
      await orderRepository.updateOrder(orderId, {
        swapId: swap.swap_id,
        updatedAt: Date.now()
      });
      
      return res.status(201).json({ 
        success: true, 
        data: {
          orderId,
          swapId: swap.swap_id,
          status: swap.status
        }
      });
    } catch (error) {
      logger.error('Error creating swap', { error });
      return res.status(500).json({ success: false, error: 'Failed to create swap' });
    }
  }

  async getSwap(req: Request, res: Response) {
    try {
      const { swapId } = req.params;
      const swap = await swapDaemonService.getSwap(swapId);
      
      return res.status(200).json({ success: true, data: swap });
    } catch (error) {
      logger.error(`Error retrieving swap ${req.params.swapId}`, { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve swap' });
    }
  }

  async getAllSwaps(req: Request, res: Response) {
    try {
      const swaps = await swapDaemonService.getAllSwaps();
      return res.status(200).json({ success: true, data: swaps });
    } catch (error) {
      logger.error('Error retrieving all swaps', { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve swaps' });
    }
  }

  async setSwapReady(req: Request, res: Response) {
    try {
      const { swapId } = req.params;
      const result = await swapDaemonService.setSwapReady(swapId);
      
      // Find the order associated with this swap
      const orders = await orderRepository.getAllOrders();
      const order = orders.find(o => o.swapId === swapId);
      
      if (order) {
        // Update the order status to READY
        await orderRepository.updateOrder(order.orderId, {
          status: 'READY',
          updatedAt: Date.now()
        });
      }
      
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error setting swap ${req.params.swapId} as ready`, { error });
      return res.status(500).json({ success: false, error: 'Failed to set swap as ready' });
    }
  }

  async claimSwap(req: Request, res: Response) {
    try {
      const { swapId } = req.params;
      const { secret } = req.body;
      
      if (!secret) {
        return res.status(400).json({ success: false, error: 'Missing claim secret' });
      }
      
      const result = await swapDaemonService.claimSwap(swapId, secret);
      
      // Find the order associated with this swap
      const orders = await orderRepository.getAllOrders();
      const order = orders.find(o => o.swapId === swapId);
      
      if (order) {
        // Update the order status to COMPLETED
        await orderRepository.updateOrder(order.orderId, {
          status: 'COMPLETED',
          updatedAt: Date.now()
        });
      }
      
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error claiming swap ${req.params.swapId}`, { error });
      return res.status(500).json({ success: false, error: 'Failed to claim swap' });
    }
  }

  async refundSwap(req: Request, res: Response) {
    try {
      const { swapId } = req.params;
      const { secret } = req.body;
      
      if (!secret) {
        return res.status(400).json({ success: false, error: 'Missing refund secret' });
      }
      
      const result = await swapDaemonService.refundSwap(swapId, secret);
      
      // Find the order associated with this swap
      const orders = await orderRepository.getAllOrders();
      const order = orders.find(o => o.swapId === swapId);
      
      if (order) {
        // Update the order status to CANCELLED
        await orderRepository.updateOrder(order.orderId, {
          status: 'CANCELLED',
          updatedAt: Date.now()
        });
      }
      
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`Error refunding swap ${req.params.swapId}`, { error });
      return res.status(500).json({ success: false, error: 'Failed to refund swap' });
    }
  }
}

export default new SwapController();
