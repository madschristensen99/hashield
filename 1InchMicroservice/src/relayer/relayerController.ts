import { Request, Response } from 'express';
import resolverService from './resolverService';
import orderRepository from '../orderManager/orderRepository';
import logger from '../common/logger';
import { ethers } from 'ethers';

export class RelayerController {
  async createEscrow(req: Request, res: Response) {
    try {
      const { 
        orderId, 
        token = ethers.constants.AddressZero, 
        amount, 
        claimSecretHash,
        refundSecretHash,
        nonce,
        value = '0'
      } = req.body;
      
      // Validate required parameters
      if (!orderId || !amount || !claimSecretHash || !refundSecretHash || !nonce) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Get the order details
      const order = await orderRepository.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      // Encode the extra data for the escrow
      const extraData = ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'bytes32', 'uint256'],
        [claimSecretHash, refundSecretHash, nonce]
      );
      
      // Create the escrow
      const receipt = await resolverService.createEscrow(
        orderId,
        token,
        amount,
        extraData,
        value
      );
      
      return res.status(200).json({ 
        success: true, 
        data: {
          orderId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        }
      });
    } catch (error) {
      logger.error('Error creating escrow', { error });
      return res.status(500).json({ success: false, error: 'Failed to create escrow' });
    }
  }

  async withdrawWithRelayer(req: Request, res: Response) {
    try {
      const { orderId, secret, fee = '0.001', salt = Math.floor(Math.random() * 1000000) } = req.body;
      
      // Validate required parameters
      if (!orderId || !secret) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Get the order details
      const order = await orderRepository.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      
      // Withdraw with relayer
      const receipt = await resolverService.withdrawWithRelayer(
        orderId,
        secret,
        fee,
        salt
      );
      
      // Update the order status
      await orderRepository.updateOrder(orderId, {
        status: 'COMPLETED',
        updatedAt: Date.now()
      });
      
      return res.status(200).json({ 
        success: true, 
        data: {
          orderId,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          fee
        }
      });
    } catch (error) {
      logger.error('Error withdrawing with relayer', { error });
      return res.status(500).json({ success: false, error: 'Failed to withdraw with relayer' });
    }
  }

  async deploySrcEscrow(req: Request, res: Response) {
    try {
      const { 
        immutables, 
        order, 
        r, 
        vs, 
        amount, 
        takerTraits, 
        args, 
        value = '0' 
      } = req.body;
      
      // Validate required parameters
      if (!immutables || !order || !r || !vs || !amount || !takerTraits || !args) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Deploy source escrow
      const receipt = await resolverService.deploySrcEscrow(
        immutables,
        order,
        r,
        vs,
        amount,
        takerTraits,
        args,
        value
      );
      
      return res.status(200).json({ 
        success: true, 
        data: {
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        }
      });
    } catch (error) {
      logger.error('Error deploying source escrow', { error });
      return res.status(500).json({ success: false, error: 'Failed to deploy source escrow' });
    }
  }

  async deployDstEscrow(req: Request, res: Response) {
    try {
      const { 
        dstImmutables, 
        srcCancellationTimestamp, 
        value = '0' 
      } = req.body;
      
      // Validate required parameters
      if (!dstImmutables || !srcCancellationTimestamp) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Deploy destination escrow
      const receipt = await resolverService.deployDstEscrow(
        dstImmutables,
        srcCancellationTimestamp,
        value
      );
      
      return res.status(200).json({ 
        success: true, 
        data: {
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        }
      });
    } catch (error) {
      logger.error('Error deploying destination escrow', { error });
      return res.status(500).json({ success: false, error: 'Failed to deploy destination escrow' });
    }
  }

  async withdrawFromEscrow(req: Request, res: Response) {
    try {
      const { escrow, secret, immutables } = req.body;
      
      // Validate required parameters
      if (!escrow || !secret || !immutables) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Withdraw from escrow
      const receipt = await resolverService.withdrawFromEscrow(
        escrow,
        secret,
        immutables
      );
      
      return res.status(200).json({ 
        success: true, 
        data: {
          escrow,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        }
      });
    } catch (error) {
      logger.error('Error withdrawing from escrow', { error });
      return res.status(500).json({ success: false, error: 'Failed to withdraw from escrow' });
    }
  }

  async cancelEscrow(req: Request, res: Response) {
    try {
      const { escrow, immutables } = req.body;
      
      // Validate required parameters
      if (!escrow || !immutables) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Cancel escrow
      const receipt = await resolverService.cancelEscrow(
        escrow,
        immutables
      );
      
      return res.status(200).json({ 
        success: true, 
        data: {
          escrow,
          transactionHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber
        }
      });
    } catch (error) {
      logger.error('Error cancelling escrow', { error });
      return res.status(500).json({ success: false, error: 'Failed to cancel escrow' });
    }
  }
}

export default new RelayerController();
