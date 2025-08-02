import React from 'react';
import { useWallet } from '../../context/WalletContext';

export const Footer: React.FC = () => {
  const { walletInfo, clearWallet } = useWallet();
  
  return (
    <>
      <div style={{ 
        marginTop: '20px', 
        padding: '10px',
        backgroundColor: '#e7f3ff',
        border: '1px solid #bee5eb',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#0c5460'
      }}>
        <strong>Security Notice:</strong> This is a Proof of Concept. 
        Do not use with real funds.
      </div>
      
      {walletInfo && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <span
            onClick={clearWallet}
            style={{
              fontSize: '10px',
              color: '#6c757d',
              cursor: 'pointer',
              textDecoration: 'underline',
              opacity: 0.7
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = '#dc3545';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.color = '#6c757d';
            }}
          >
            Change secret
          </span>
        </div>
      )}
    </>
  );
};
