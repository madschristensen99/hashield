import React from 'react';
import { useWallet } from '../../context/WalletContext';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { colors } from '../../styles/theme';

interface WalletInfoProps {
  compact?: boolean;
}

export const WalletInfo: React.FC<WalletInfoProps> = ({ compact = false }) => {
  const { 
    walletInfo, 
    showSessionList, 
    setShowSessionList, 
    sessionAddresses, 
    loadSessionAddresses,
    switchToSession,
    masterBalance,
    addressSpoofing,
    toggleAddressSpoofing,
    openEtherscan
  } = useWallet();

  if (!walletInfo) return null;

  if (compact) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '10px 15px',
        marginBottom: '15px',
        backgroundColor: colors.background,
        borderRadius: '8px',
        border: `1px solid ${colors.monero.primary}`,
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: colors.monero.primary }}>
            HashShield Wallet
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: colors.text, 
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center' 
          }}>
            <span style={{ 
              display: 'inline-block', 
              width: '8px', 
              height: '8px', 
              backgroundColor: '#28a745', 
              borderRadius: '50%',
              marginRight: '5px' 
            }}></span>
            {walletInfo.currentSessionAddress?.substring(0, 6)}...{walletInfo.currentSessionAddress?.substring(38)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: colors.text, textAlign: 'right' }}>
            Balance
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: colors.monero.primary }}>
            {masterBalance} ETH
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <h3 style={{ margin: '0 0 15px 0', color: colors.text }}>
        HashShield Wallet
      </h3>
      
      {walletInfo.currentSessionAddress && (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong style={{ color: '#28a745' }}>Current Session Address:</strong>
            <span
              onClick={() => {
                setShowSessionList(!showSessionList);
                if (!showSessionList) {
                  loadSessionAddresses();
                }
              }}
              style={{
                fontSize: '11px',
                color: '#6c757d',
                cursor: 'pointer',
                textDecoration: 'underline',
                opacity: 0.8,
                transition: 'opacity 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.color = '#495057';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
                e.currentTarget.style.color = '#6c757d';
              }}
            >
              {showSessionList ? 'Hide Sessions' : 'Show All Sessions'}
            </span>
          </div>
          
          <div style={{ 
            marginTop: '5px',
            wordBreak: 'break-all',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#6c757d',
            backgroundColor: '#e9ecef',
            padding: '6px',
            borderRadius: '3px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{walletInfo.currentSessionAddress}</span>
            <span
              onClick={() => openEtherscan(walletInfo.currentSessionAddress || '')}
              style={{
                cursor: 'pointer',
                color: '#007bff',
                marginLeft: '8px',
                fontSize: '14px'
              }}
              title="View on Etherscan"
            >
              🔍
            </span>
          </div>
          
          {showSessionList && (
            <div style={{ 
              marginTop: '10px',
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px solid #e9ecef',
              borderRadius: '4px'
            }}>
              {sessionAddresses.map(session => (
                <div
                  key={session.sessionNumber}
                  onClick={() => !session.isCurrent && switchToSession(session.sessionNumber)}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid #e9ecef',
                    backgroundColor: session.isCurrent ? '#e2f3ff' : 'transparent',
                    cursor: session.isCurrent ? 'default' : 'pointer',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!session.isCurrent) {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!session.isCurrent) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#495057' }}>
                      Session #{session.sessionNumber} {session.isCurrent && '(Current)'}
                    </div>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6c757d' }}>
                      {session.address}
                    </div>
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openEtherscan(session.address);
                    }}
                    style={{
                      cursor: 'pointer',
                      color: '#007bff',
                      fontSize: '14px'
                    }}
                    title="View on Etherscan"
                  >
                    🔍
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <strong style={{ color: '#495057' }}>Master Balance:</strong>
          <span style={{ color: '#28a745', fontWeight: 'bold' }}>
            {parseFloat(masterBalance).toFixed(4)} ETH
          </span>
        </div>
      </div>
      
      <div style={{ 
        marginBottom: '15px',
        padding: '12px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px'
      }}>
        <p style={{ fontSize: '13px', color: '#856404', margin: '0 0 10px 0' }}>
          <strong>🔄 Fresh Address Mode:</strong> Each time you connect to a dApp, 
          a new address will be generated for enhanced privacy.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="addressSpoofing"
            checked={addressSpoofing}
            onChange={toggleAddressSpoofing}
            style={{ cursor: 'pointer' }}
          />
          <label 
            htmlFor="addressSpoofing" 
            style={{ fontSize: '12px', color: '#856404', cursor: 'pointer' }}
          >
            <strong>🎭 Address Spoofing:</strong> Show fake rich address to dApps to enable actions.
          </label>
        </div>
      </div>
    </Card>
  );
};
