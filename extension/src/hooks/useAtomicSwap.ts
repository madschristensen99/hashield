"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useMonero } from "../popup/context/MoneroContext";
import { useWallet } from "../popup/context/WalletContext";

// Define the types for the swap parameters
export interface AtomicSwapParams {
  srcChainId: number;
  dstChainId: number;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  walletAddress?: string; // Optional as it will be provided by the background script
  xmrAddress?: string;   // Optional as it will be provided by the background script
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

export const useAtomicSwap = () => {
  // State management
  const [currentStep, setCurrentStep] = useState<SwapStep>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderResponse | null>(null);
  const [activeSwap, setActiveSwap] = useState<SwapStatus | null>(null);

  // Get wallet info from context
  const { walletInfo } = useWallet();
  const { moneroWalletInitialized } = useMonero();

  // Add a log entry
  const addLog = (message: string) => {
    setLogs(prevLogs => [...prevLogs, `${new Date().toISOString()} - ${message}`]);
  };

  // Create a new atomic swap order
  const createOrder = async (params: AtomicSwapParams) => {
    setCurrentStep("creating-order");
    addLog("Creating atomic swap order...");

    try {
      // Validate parameters
      if (!params.srcChainId || !params.dstChainId || !params.srcTokenAddress || 
          !params.dstTokenAddress || !params.amount) {
        throw new Error("Missing required parameters for atomic swap");
      }

      // Format amount as a string
      const formattedParams = {
        ...params,
        amount: params.amount.toString()
      };

      // Call the background script to create an order
      const response = await chrome.runtime.sendMessage({
        type: 'createAtomicSwapOrder',
        ...formattedParams
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to create order");
      }

      addLog(`Order created with ID: ${response.data?.orderId}`);
      setActiveOrder({
        success: true,
        data: response.data
      });
      setCurrentStep("waiting-confirmation");
      return {
        success: true,
        data: response.data
      };
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
      const response = await chrome.runtime.sendMessage({
        type: 'getAtomicSwapOrder',
        orderId
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to get order status");
      }

      setActiveSwap(response.data);
      
      // Update the current step based on the order status
      switch (response.data.status) {
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

      addLog(`Order status: ${response.data.status}`);
      return response.data;
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

      // Call the background script to initiate the swap
      const response = await chrome.runtime.sendMessage({
        type: 'initiateAtomicSwap',
        orderId
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to initiate swap");
      }

      addLog(`Swap initiated with ID: ${response.data.swapId}`);
      
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
      // Ensure we have wallet info
      if (!walletInfo || !walletInfo.currentSessionAddress) {
        throw new Error("Ethereum wallet not connected");
      }

      // Ensure Monero wallet is initialized
      if (!moneroWalletInitialized) {
        throw new Error("Monero wallet not initialized");
      }

      // Create the order - note we don't need to provide walletAddress or xmrAddress
      // as the background script will get these from the current wallets
      const orderParams: AtomicSwapParams = {
        srcChainId,
        dstChainId,
        srcTokenAddress,
        dstTokenAddress,
        amount
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
