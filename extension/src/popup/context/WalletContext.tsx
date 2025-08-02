import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

// Define interfaces
interface WalletInfo {
  masterAddress: string;
  currentSessionAddress: string | null;
  sessionCount: number;
  moneroInitialized?: boolean;
}

interface SessionAddress {
  sessionNumber: number;
  address: string;
  isCurrent: boolean;
}

interface WalletContextType {
  walletInfo: WalletInfo | null;
  mnemonic: string;
  setMnemonic: (mnemonic: string) => void;
  isImporting: boolean;
  error: string;
  sessionAddresses: SessionAddress[];
  showSessionList: boolean;
  setShowSessionList: (show: boolean) => void;
  masterBalance: string;
  addressSpoofing: boolean;
  importWallet: () => Promise<void>;
  clearWallet: () => Promise<void>;
  loadSessionAddresses: () => Promise<void>;
  switchToSession: (sessionNumber: number) => Promise<void>;
  toggleAddressSpoofing: () => Promise<void>;
  loadMasterBalance: () => Promise<void>;
  openEtherscan: (address: string) => void;
}

// Create context with default values
export const WalletContext = createContext<WalletContextType>({
  walletInfo: null,
  mnemonic: '',
  setMnemonic: () => {},
  isImporting: false,
  error: '',
  sessionAddresses: [],
  showSessionList: false,
  setShowSessionList: () => {},
  masterBalance: '0',
  addressSpoofing: true,
  importWallet: async () => {},
  clearWallet: async () => {},
  loadSessionAddresses: async () => {},
  switchToSession: async () => {},
  toggleAddressSpoofing: async () => {},
  loadMasterBalance: async () => {},
  openEtherscan: () => {},
});

// Create provider component
export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [mnemonic, setMnemonic] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [addressSpoofing, setAddressSpoofing] = useState(true);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionAddresses, setSessionAddresses] = useState<SessionAddress[]>([]);
  const [masterBalance, setMasterBalance] = useState<string>('0');

  // Load existing wallet on component mount
  useEffect(() => {
    loadExistingWallet();
    loadAddressSpoofing();
    loadMasterBalance();
  }, []);

  // Load existing wallet from chrome storage
  const loadExistingWallet = async () => {
    try {
      const result = await chrome.storage.local.get(['walletInfo']);
      if (result.walletInfo) {
        setWalletInfo(result.walletInfo);
      }
    } catch (err) {
      console.error('Error loading wallet:', err);
    }
  };

  // Load address spoofing setting
  const loadAddressSpoofing = async () => {
    try {
      const result = await chrome.storage.local.get(['addressSpoofing']);
      setAddressSpoofing(result.addressSpoofing || true);
    } catch (err) {
      console.error('Error loading address spoofing setting:', err);
    }
  };

  // Toggle address spoofing
  const toggleAddressSpoofing = async () => {
    const newValue = !addressSpoofing;
    setAddressSpoofing(newValue);
    try {
      await chrome.storage.local.set({ addressSpoofing: newValue });
      await chrome.runtime.sendMessage({ type: 'setAddressSpoofing', enabled: newValue });
    } catch (err) {
      console.error('Error toggling address spoofing:', err);
    }
  };

  // Load master balance
  const loadMasterBalance = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getMasterBalance' });
      if (response && !response.error) {
        setMasterBalance(response.balance);
      }
    } catch (err) {
      console.error('Error loading master balance:', err);
    }
  };

  // Load session addresses
  const loadSessionAddresses = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getSessionAddresses' });
      if (response && !response.error && response.addresses) {
        setSessionAddresses(response.addresses);
      }
    } catch (err) {
      console.error('Error loading session addresses:', err);
    }
  };

  // Switch to a different session
  const switchToSession = async (sessionNumber: number) => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'switchToSession', sessionNumber });
      if (response && !response.error) {
        await loadExistingWallet();
        setShowSessionList(false);
      }
    } catch (err) {
      console.error('Error switching session:', err);
      setError('Failed to switch session');
    }
  };

  // Import wallet
  const importWallet = async () => {
    setIsImporting(true);
    setError('');
    
    try {
      // Validate mnemonic - ensure it's a valid BIP39 mnemonic
      const trimmedMnemonic = mnemonic.trim();
      
      try {
        // This will throw if the mnemonic is invalid
        ethers.Wallet.fromPhrase(trimmedMnemonic);
      } catch (e) {
        console.error('Mnemonic validation error:', e);
        throw new Error('Invalid seed phrase');
      }
      
      // Send to background script
      const response = await chrome.runtime.sendMessage({
        type: 'importWallet',
        seedPhrase: trimmedMnemonic // Match the parameter name expected by background.ts
      });
      
      if (response && !response.error) {
        setWalletInfo(response.walletInfo);
        setMnemonic('');
      } else {
        throw new Error(response?.error || 'Failed to import wallet');
      }
    } catch (err: any) {
      console.error('Error importing wallet:', err);
      setError(err.message || 'Failed to import wallet');
    } finally {
      setIsImporting(false);
    }
  };

  // Clear wallet
  const clearWallet = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'clearWallet' });
      setWalletInfo(null);
      setMnemonic('');
      setError('');
    } catch (err) {
      console.error('Error clearing wallet:', err);
    }
  };

  // Open Etherscan
  const openEtherscan = (address: string) => {
    chrome.tabs.create({
      url: `https://sepolia.etherscan.io/address/${address}`
    });
  };

  return (
    <WalletContext.Provider value={{
      walletInfo,
      mnemonic,
      setMnemonic,
      isImporting,
      error,
      sessionAddresses,
      showSessionList,
      setShowSessionList,
      masterBalance,
      addressSpoofing,
      importWallet,
      clearWallet,
      loadSessionAddresses,
      switchToSession,
      toggleAddressSpoofing,
      loadMasterBalance,
      openEtherscan
    }}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use wallet context
export const useWallet = () => useContext(WalletContext);
