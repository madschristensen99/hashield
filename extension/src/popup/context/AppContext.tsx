import { ReactNode } from 'react';
import { WalletProvider } from './WalletContext';
import { MoneroProvider } from './MoneroContext';
import { TransactionProvider } from './TransactionContext';

// Root provider that combines all context providers
export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <WalletProvider>
      <MoneroProvider>
        <TransactionProvider>
          {children}
        </TransactionProvider>
      </MoneroProvider>
    </WalletProvider>
  );
};
