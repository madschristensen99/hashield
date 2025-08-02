import { Request, Response } from 'express';
import oneInchService from './oneInchService';
import orderRepository from './orderRepository';
import logger from '../common/logger';
import { SwapParams } from '../common/types';
import { ethers } from 'ethers';

export class OrderController {
  async getActiveOrders(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const orders = await oneInchService.getActiveOrders(page, limit);
      return res.status(200).json({ success: true, data: orders });
    } catch (error) {
      logger.error('Error retrieving active orders', { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve active orders' });
    }
  }

  async getOrdersByMaker(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!ethers.utils.isAddress(address)) {
        return res.status(400).json({ success: false, error: 'Invalid Ethereum address' });
      }
      
      const orders = await oneInchService.getOrdersByMaker(address, page, limit);
      return res.status(200).json({ success: true, data: orders });
    } catch (error) {
      logger.error(`Error retrieving orders for maker ${req.params.address}`, { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const order = await orderRepository.getOrderById(orderId);
      
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      return res.status(200).json({ success: true, data: order });
    } catch (error) {
      logger.error(`Error retrieving order ${req.params.orderId}`, { error });
      return res.status(500).json({ success: false, error: 'Failed to retrieve order' });
    }
  }

  async createOrder(req: Request, res: Response) {
    try {
      const params: SwapParams = req.body;
      
      // Validate required parameters
      if (!params.srcChainId || !params.dstChainId || !params.srcTokenAddress || 
          !params.dstTokenAddress || !params.amount || !params.walletAddress || !params.xmrAddress) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Create the order using the 1inch service
      const result = await oneInchService.createOrder(params);
      
      // Store the order in the repository
      const orderDetails = {
        orderId: result.order.orderHash,
        swapId: '', // Will be populated when the swap is created
        srcChainId: params.srcChainId,
        dstChainId: params.dstChainId,
        srcTokenAddress: params.srcTokenAddress,
        dstTokenAddress: params.dstTokenAddress,
        amount: params.amount,
        walletAddress: params.walletAddress,
        xmrAddress: params.xmrAddress,
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        claimSecret: result.secrets.claim,
        refundSecret: result.secrets.refund,
        claimSecretHash: result.secretHashes.claim,
        refundSecretHash: result.secretHashes.refund
      };
      
      await orderRepository.saveOrder(orderDetails);
      
      return res.status(201).json({ 
        success: true, 
        data: {
          orderId: (result.order as any).orderHash || '',
          orderDetails: result.order
        }
      });
    } catch (error) {
      logger.error('Error creating order', { error });
      return res.status(500).json({ success: false, error: 'Failed to create order' });
    }
  }

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { status, swapId } = req.body;
      
      if (!['PENDING', 'READY', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      
      const order = await orderRepository.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      const updatedOrder = await orderRepository.updateOrder(orderId, { 
        status, 
        swapId: swapId || order.swapId,
        updatedAt: Date.now()
      });
      
      return res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
      logger.error(`Error updating order ${req.params.orderId}`, { error });
      return res.status(500).json({ success: false, error: 'Failed to update order' });
    }
  }
}

export default new OrderController();
