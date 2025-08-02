import { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// Define interfaces
interface PendingTransaction {
  id: string;
  txParams: any;
  timestamp: number;
  from: string;
}

interface TransactionProgress {
  txId: string;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  status: 'processing' | 'completed' | 'error';
  txHash?: string;
  error?: string;
}

interface TransactionContextType {
  pendingTransactions: PendingTransaction[];
  transactionProgress: TransactionProgress | null;
  loadPendingTransactions: () => Promise<void>;
  approveTransaction: (txId: string) => Promise<void>;
  rejectTransaction: (txId: string) => Promise<void>;
  loadTransactionProgress: () => Promise<void>;
}

// Create context with default values
export const TransactionContext = createContext<TransactionContextType>({
  pendingTransactions: [],
  transactionProgress: null,
  loadPendingTransactions: async () => {},
  approveTransaction: async () => {},
  rejectTransaction: async () => {},
  loadTransactionProgress: async () => {}
});

// Create provider component
export const TransactionProvider = ({ children }: { children: ReactNode }) => {
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [transactionProgress, setTransactionProgress] = useState<TransactionProgress | null>(null);

  // Load pending transactions and transaction progress on component mount
  useEffect(() => {
    loadPendingTransactions();
    
    // Poll for transaction progress updates
    const progressInterval = setInterval(loadTransactionProgress, 1000);
    return () => clearInterval(progressInterval);
  }, []);

  // Load pending transactions
  const loadPendingTransactions = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getPendingTransactions' });
      if (response && !response.error) {
        setPendingTransactions(response.transactions || []);
      }
    } catch (err) {
      console.error('Error loading pending transactions:', err);
    }
  };

  // Approve transaction
  const approveTransaction = async (txId: string) => {
    try {
      await chrome.runtime.sendMessage({ type: 'approveTransaction', txId });
      await loadPendingTransactions();
    } catch (err) {
      console.error('Error approving transaction:', err);
    }
  };

  // Reject transaction
  const rejectTransaction = async (txId: string) => {
    try {
      await chrome.runtime.sendMessage({ type: 'rejectTransaction', txId });
      await loadPendingTransactions();
    } catch (err) {
      console.error('Error rejecting transaction:', err);
    }
  };

  // Load transaction progress
  const loadTransactionProgress = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getTransactionProgress' });
      if (response && response.progress) {
        setTransactionProgress(response.progress);
      } else {
        setTransactionProgress(null);
      }
    } catch (err) {
      console.error('Error loading transaction progress:', err);
    }
  };

  return (
    <TransactionContext.Provider value={{
      pendingTransactions,
      transactionProgress,
      loadPendingTransactions,
      approveTransaction,
      rejectTransaction,
      loadTransactionProgress
    }}>
      {children}
    </TransactionContext.Provider>
  );
};

// Custom hook to use transaction context
export const useTransaction = () => useContext(TransactionContext);
