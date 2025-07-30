import { OrderDetails } from '../common/types';
import logger from '../common/logger';
import fs from 'fs';
import path from 'path';

/**
 * Simple file-based repository for storing order details
 * In a production environment, this would be replaced with a proper database
 */
export class OrderRepository {
  private dataDir: string;
  private ordersFile: string;
  private orders: Map<string, OrderDetails>;

  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.ordersFile = path.join(this.dataDir, 'orders.json');
    this.orders = new Map<string, OrderDetails>();
    
    // Initialize the data directory and load existing orders
    this.init();
  }

  private init() {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Load existing orders if the file exists
      if (fs.existsSync(this.ordersFile)) {
        const data = fs.readFileSync(this.ordersFile, 'utf8');
        const ordersArray = JSON.parse(data) as OrderDetails[];
        
        // Populate the orders map
        ordersArray.forEach(order => {
          this.orders.set(order.orderId, order);
        });
        
        logger.info(`Loaded ${ordersArray.length} orders from storage`);
      } else {
        // Create an empty orders file
        this.saveToFile();
        logger.info('Created new orders storage file');
      }
    } catch (error) {
      logger.error('Error initializing order repository', { error });
      throw error;
    }
  }

  private saveToFile() {
    try {
      const ordersArray = Array.from(this.orders.values());
      fs.writeFileSync(this.ordersFile, JSON.stringify(ordersArray, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving orders to file', { error });
      throw error;
    }
  }

  async getAllOrders(): Promise<OrderDetails[]> {
    return Array.from(this.orders.values());
  }

  async getOrderById(orderId: string): Promise<OrderDetails | undefined> {
    return this.orders.get(orderId);
  }

  async getOrdersByStatus(status: string): Promise<OrderDetails[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async getOrdersByWalletAddress(walletAddress: string): Promise<OrderDetails[]> {
    return Array.from(this.orders.values()).filter(
      order => order.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  }

  async getOrdersByXmrAddress(xmrAddress: string): Promise<OrderDetails[]> {
    return Array.from(this.orders.values()).filter(
      order => order.xmrAddress === xmrAddress
    );
  }

  async saveOrder(order: any): Promise<OrderDetails> {
    this.orders.set(order.orderId, order as OrderDetails);
    this.saveToFile();
    return order as OrderDetails;
  }

  async updateOrder(orderId: string, updates: Partial<OrderDetails>): Promise<OrderDetails | undefined> {
    const order = this.orders.get(orderId);
    
    if (!order) {
      return undefined;
    }
    
    // Update the order with the new values
    const updatedOrder = { ...order, ...updates };
    this.orders.set(orderId, updatedOrder);
    this.saveToFile();
    
    return updatedOrder;
  }

  async deleteOrder(orderId: string): Promise<boolean> {
    const result = this.orders.delete(orderId);
    if (result) {
      this.saveToFile();
    }
    return result;
  }
}

export default new OrderRepository();
