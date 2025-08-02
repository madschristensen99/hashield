import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useWallet } from './WalletContext';

// Define interfaces
interface TransferState {
  status: 'idle' | 'in-progress' | 'completed' | 'error';
  step: 'idle' | 'initiating' | 'processing' | 'completed' | 'error';
  logs: string[];
  error: string | null;
  txHash: string | null;
}

interface PaymentForm {
  destinationAddress: string;
  amount: string;
}

interface MoneroContextType {
  moneroWalletInitialized: boolean;
  transferState: TransferState;
  paymentForm: PaymentForm;
  setPaymentForm: (form: PaymentForm) => void;
  resetTransfer: () => void;
  checkMoneroWalletStatus: () => Promise<void>;
  executeMoneroTransfer: () => Promise<void>;
}

// Create context with default values
export const MoneroContext = createContext<MoneroContextType>({
  moneroWalletInitialized: false,
  transferState: {
    status: 'idle',
    step: 'idle',
    logs: [],
    error: null,
    txHash: null
  },
  paymentForm: {
    destinationAddress: '',
    amount: ''
  },
  setPaymentForm: () => {},
  resetTransfer: () => {},
  checkMoneroWalletStatus: async () => {},
  executeMoneroTransfer: async () => {}
});

// Create provider component
export const MoneroProvider = ({ children }: { children: ReactNode }) => {
  const { walletInfo } = useWallet();
  const [moneroWalletInitialized, setMoneroWalletInitialized] = useState(false);
  const [transferState, setTransferState] = useState<TransferState>({
    status: 'idle',
    step: 'idle',
    logs: [],
    error: null,
    txHash: null
  });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    destinationAddress: '',
    amount: ''
  });

  // Check Monero wallet status on component mount and when wallet info changes
  useEffect(() => {
    // If wallet info has moneroInitialized flag, use it
    if (walletInfo && walletInfo.moneroInitialized) {
      setMoneroWalletInitialized(true);
    } else {
      // Otherwise check storage
      checkMoneroWalletStatus();
    }
    
    // Listen for Monero transaction updates
    const handleMessage = (message: any) => {
      if (message.type === 'moneroTransferUpdate') {
        setTransferState(prevState => ({
          ...prevState,
          status: message.data.status,
          step: message.data.step,
          logs: [...prevState.logs, message.data.log],
          error: message.data.error,
          txHash: message.data.txHash
        }));
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [walletInfo]);

  // Reset transfer state
  const resetTransfer = () => {
    setTransferState({
      status: 'idle',
      step: 'idle',
      logs: [],
      error: null,
      txHash: null
    });
  };

  // Check if Monero wallet is initialized
  const checkMoneroWalletStatus = async () => {
    try {
      const result = await chrome.storage.local.get(['moneroInitialized']);
      setMoneroWalletInitialized(!!result.moneroInitialized);
    } catch (err) {
      console.error('Error checking Monero wallet status:', err);
    }
  };

  // Execute Monero transfer
  const executeMoneroTransfer = async () => {
    try {
      // Reset previous state
      setTransferState({
        status: 'in-progress',
        step: 'initiating',
        logs: ['Initiating Monero transfer...'],
        error: null,
        txHash: null
      });
      
      // Send transfer request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'executeMoneroTransfer',
        destinationAddress: paymentForm.destinationAddress,
        amount: paymentForm.amount
      });
      
      if (response && response.error) {
        throw new Error(response.error);
      }
      
      // Initial update (the rest will come through message listeners)
      setTransferState(prevState => ({
        ...prevState,
        step: 'processing',
        logs: [...prevState.logs, 'Transfer request sent to Monero wallet']
      }));
    } catch (err: any) {
      console.error('Error executing Monero transfer:', err);
      setTransferState(prevState => ({
        ...prevState,
        status: 'error',
        step: 'error',
        logs: [...prevState.logs, `Error: ${err.message}`],
        error: err.message
      }));
    }
  };

  return (
    <MoneroContext.Provider value={{
      moneroWalletInitialized,
      transferState,
      paymentForm,
      setPaymentForm,
      resetTransfer,
      checkMoneroWalletStatus,
      executeMoneroTransfer
    }}>
      {children}
    </MoneroContext.Provider>
  );
};

// Custom hook to use Monero context
export const useMonero = () => useContext(MoneroContext);
