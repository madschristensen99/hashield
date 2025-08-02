import React from 'react';
import { useTransaction } from '../../context/TransactionContext';
import { Button } from '../common/Button';

export const PendingTransactions: React.FC = () => {
  const { pendingTransactions, approveTransaction, rejectTransaction } = useTransaction();

  if (pendingTransactions.length === 0) return null;

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#FF6600' }}>
        Pending Transactions ({pendingTransactions.length})
      </h3>
      
      <div style={{ 
        maxHeight: '300px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {pendingTransactions.map(tx => (
          <div
            key={tx.id}
            style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: '4px'
            }}
          >
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#495057' }}>
              <strong>From:</strong> {tx.from}
            </div>
            
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#495057' }}>
              <strong>To:</strong> {tx.txParams.to || 'Contract Creation'}
            </div>
            
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#495057' }}>
              <strong>Value:</strong> {tx.txParams.value ? `${ethers.formatEther(tx.txParams.value)} ETH` : '0 ETH'}
            </div>
            
            <div style={{ marginBottom: '12px', fontSize: '11px', color: '#6c757d' }}>
              Gas Limit: {tx.txParams.gasLimit || 'Not set'}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                onClick={() => approveTransaction(tx.id)}
                variant="primary"
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#28a745',
                  fontSize: '12px'
                }}
              >
                ✅ Approve
              </Button>
              <Button
                onClick={() => rejectTransaction(tx.id)}
                variant="secondary"
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#dc3545',
                  fontSize: '12px'
                }}
              >
                ❌ Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
