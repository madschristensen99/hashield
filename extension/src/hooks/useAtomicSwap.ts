"use client";

import { useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { useMonero } from "../popup/context/MoneroContext";
import { useWallet } from "../popup/context/WalletContext";

// Define the API base URL - this should be configurable in a production environment
const API_BASE_URL = "http://localhost:3000";

// Define the types for the swap parameters
export interface AtomicSwapParams {
  srcChainId: number;
  dstChainId: number;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  walletAddress: string;
  xmrAddress: string;
}

export interface OrderResponse {
  success: boolean;
  data?: {
    orderId: string;
    orderDetails: any;
  };
  error?: string;
}

export interface SwapStatus {
  orderId: string;
  swapId: string;
  status: 'PENDING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  srcChainId: number;
  dstChainId: number;
  amount: string;
  createdAt: number;
  updatedAt: number;
}

export type SwapStep = 
  | "idle"
  | "creating-order"
  | "waiting-confirmation"
  | "ready-for-swap"
  | "swap-in-progress"
  | "completed"
  | "error";

export function useAtomicSwap() {
  const [currentStep, setCurrentStep] = useState<SwapStep>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);
  const [activeSwap, setActiveSwap] = useState<SwapStatus | null>(null);
  
  const { moneroWallet } = useMonero();
  const { walletInfo } = useWallet();

  const addLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);

  // Create a new atomic swap order
  const createOrder = async (params: AtomicSwapParams) => {
    setCurrentStep("creating-order");
    addLog("Creating atomic swap order...");

    try {
      // Validate parameters
      if (!params.srcChainId || !params.dstChainId || !params.srcTokenAddress || 
          !params.dstTokenAddress || !params.amount || !params.walletAddress || !params.xmrAddress) {
        throw new Error("Missing required parameters for atomic swap");
      }

      // Format amount as a string (the API expects a string)
      const formattedParams = {
        ...params,
        amount: params.amount.toString()
      };

      // Call the microservice API to create an order
      const response = await axios.post<OrderResponse>(
        `${API_BASE_URL}/api/orders`,
        formattedParams
      );

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to create order");
      }

      addLog(`Order created with ID: ${response.data.data?.orderId}`);
      setActiveOrder(response.data);
      setCurrentStep("waiting-confirmation");
      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error creating order";
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
      setCurrentStep("error");
      throw err;
    }
  };

  // Get the status of an existing order
  const getOrderStatus = async (orderId: string) => {
    try {
      addLog(`Checking status of order ${orderId}...`);
      const response = await axios.get<{ success: boolean; data: SwapStatus }>(
        `${API_BASE_URL}/api/orders/${orderId}`
      );

      if (!response.data.success) {
        throw new Error("Failed to get order status");
      }

      setActiveSwap(response.data.data);
      
      // Update the current step based on the order status
      switch (response.data.data.status) {
        case "PENDING":
          setCurrentStep("waiting-confirmation");
          break;
        case "READY":
          setCurrentStep("ready-for-swap");
          break;
        case "COMPLETED":
          setCurrentStep("completed");
          break;
        case "CANCELLED":
          setCurrentStep("error");
          setError("Order was cancelled");
          break;
      }

      addLog(`Order status: ${response.data.data.status}`);
      return response.data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error checking order status";
      addLog(`Error: ${errorMessage}`);
      return null;
    }
  };

  // Initiate a swap based on an existing order
  const initiateSwap = async (orderId: string) => {
    try {
      setCurrentStep("swap-in-progress");
      addLog("Initiating atomic swap...");

      // Get the order details first
      const order = await getOrderStatus(orderId);
      if (!order) {
        throw new Error("Could not retrieve order details");
      }

      // Create a swap using the order details
      const response = await axios.post(`${API_BASE_URL}/api/swaps`, {
        orderId: orderId,
        srcChainId: order.srcChainId,
        dstChainId: order.dstChainId,
        amount: order.amount
      });

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to initiate swap");
      }

      addLog(`Swap initiated with ID: ${response.data.data.swapId}`);
      
      // Update the order status to link it with the swap
      await axios.patch(`${API_BASE_URL}/api/orders/${orderId}`, {
        status: "READY",
        swapId: response.data.data.swapId
      });

      // Update the active swap
      const updatedSwap = await getOrderStatus(orderId);
      return updatedSwap;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error initiating swap";
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
      setCurrentStep("error");
      throw err;
    }
  };

  // Execute a complete atomic swap flow
  const executeAtomicSwap = async (
    srcChainId: number,
    dstChainId: number,
    srcTokenAddress: string,
    dstTokenAddress: string,
    amount: string
  ) => {
    try {
      // Ensure we have wallet info and a Monero address
      if (!walletInfo || !walletInfo.address) {
        throw new Error("Ethereum wallet not connected");
      }

      if (!moneroWallet || !moneroWallet.address) {
        throw new Error("Monero wallet not connected");
      }

      // Create the order
      const orderParams: AtomicSwapParams = {
        srcChainId,
        dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        amount,
        walletAddress: walletInfo.address,
        xmrAddress: moneroWallet.address
      };

      const orderResponse = await createOrder(orderParams);
      
      // Wait for order confirmation (in a real app, this might involve polling or websockets)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Initiate the swap
      if (orderResponse?.data?.orderId) {
        await initiateSwap(orderResponse.data.orderId);
        setCurrentStep("completed");
        addLog("Atomic swap completed successfully!");
      }
    } catch (error) {
      setCurrentStep("error");
      const errorMessage = error instanceof Error ? error.message : "Unknown error during swap";
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
    }
  };

  const reset = () => {
    setCurrentStep("idle");
    setLogs([]);
    setError(null);
    setActiveOrder(null);
    setActiveSwap(null);
  };

  return {
    currentStep,
    logs,
    error,
    activeOrder,
    activeSwap,
    createOrder,
    getOrderStatus,
    initiateSwap,
    executeAtomicSwap,
    reset
  };
}
