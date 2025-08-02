import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { useWallet } from './context/WalletContext';
import { useMonero } from './context/MoneroContext';
import { Layout } from './components/layout/Layout';
import { WalletImport } from './components/wallet/WalletImport';
import { WalletInfo } from './components/wallet/WalletInfo';
import { MoneroWallet } from './components/monero/MoneroWallet';
import { MoneroTransfer } from './components/monero/MoneroTransfer';
import { PendingTransactions } from './components/transactions/PendingTransactions';
import { TransactionProgress } from './components/transactions/TransactionProgress';
import { colors } from './styles/theme';

// Tab interface for main navigation
interface TabProps {
  active: string;
  onChange: (tab: string) => void;
}

const TabNavigation: React.FC<TabProps> = ({ active, onChange }) => {
  const tabs = [
    { id: 'monero', label: 'Monero Wallet' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'settings', label: 'Settings' }
  ];
  
  return (
    <div style={{
      display: 'flex',
      marginBottom: '20px',
      borderBottom: `2px solid ${colors.background}`,
      padding: '0 10px'
    }}>
      {tabs.map(tab => (
        <div 
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '10px 15px',
            cursor: 'pointer',
            fontWeight: active === tab.id ? 'bold' : 'normal',
            color: active === tab.id ? colors.monero.primary : colors.text,
            borderBottom: active === tab.id ? `3px solid ${colors.monero.primary}` : 'none',
            marginBottom: active === tab.id ? '-2px' : '0',
            transition: 'all 0.2s ease'
          }}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
};

// Main application content component
const AppContent: React.FC = () => {
  const { walletInfo } = useWallet();
  const { moneroWalletInitialized } = useMonero();
  const [activeTab, setActiveTab] = useState('monero');

  if (!walletInfo) {
    return (
      <Layout>
        <WalletImport />
      </Layout>
    );
  }

  return (
    <Layout>
      <WalletInfo compact={true} />
      
      <TabNavigation active={activeTab} onChange={setActiveTab} />
      
      {activeTab === 'monero' && (
        <div>
          <MoneroWallet />
          <MoneroTransfer />
        </div>
      )}
      
      {activeTab === 'transactions' && (
        <div>
          <PendingTransactions />
          <TransactionProgress />
        </div>
      )}
      
      {activeTab === 'settings' && (
        <div style={{ padding: '10px', color: colors.text }}>
          <h3 style={{ color: colors.monero.primary, marginTop: 0 }}>Settings</h3>
          <p>Manage your wallet settings and preferences here.</p>
          {/* Add settings options here */}
        </div>
      )}
    </Layout>
  );
};

// Root App component
export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
