import React from 'react';
import { useTransaction } from '../../context/TransactionContext';

export const TransactionProgress: React.FC = () => {
  const { transactionProgress } = useTransaction();

  if (!transactionProgress) return null;

  const { currentStep, totalSteps, stepName, status, txHash, error } = transactionProgress;
  
  const getStatusColor = () => {
    switch (status) {
      case 'processing': return '#1565c0';
      case 'completed': return '#2e7d32';
      case 'error': return '#c62828';
      default: return '#1565c0';
    }
  };

  const getStatusBackground = () => {
    switch (status) {
      case 'processing': return '#e3f2fd';
      case 'completed': return '#e8f5e9';
      case 'error': return '#ffebee';
      default: return '#e3f2fd';
    }
  };

  const getStatusBorder = () => {
    switch (status) {
      case 'processing': return '#bbdefb';
      case 'completed': return '#c8e6c9';
      case 'error': return '#ffcdd2';
      default: return '#bbdefb';
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: getStatusColor() }}>
        Transaction Progress
      </h3>
      
      <div style={{ 
        padding: '12px',
        backgroundColor: getStatusBackground(),
        border: `1px solid ${getStatusBorder()}`,
        borderRadius: '4px'
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 'bold',
          color: getStatusColor(),
          marginBottom: '10px'
        }}>
          {status === 'processing' ? `Step ${currentStep}/${totalSteps}: ${stepName}` : 
           status === 'completed' ? 'Transaction Completed' : 'Transaction Failed'}
        </div>
        
        {/* Progress bar */}
        <div style={{ 
          height: '8px',
          backgroundColor: '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '15px'
        }}>
          <div style={{ 
            height: '100%',
            width: `${(currentStep / totalSteps) * 100}%`,
            backgroundColor: getStatusColor(),
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
        
        {txHash && (
          <div style={{ marginBottom: '10px' }}>
            <strong>Transaction Hash:</strong>
            <div style={{ 
              wordBreak: 'break-all',
              fontSize: '11px',
              fontFamily: 'monospace',
              backgroundColor: '#f5f5f5',
              padding: '6px',
              borderRadius: '3px',
              marginTop: '5px'
            }}>
              {txHash}
            </div>
          </div>
        )}
        
        {error && (
          <div style={{ 
            marginTop: '10px',
            color: '#c62828',
            fontSize: '12px',
            padding: '8px',
            backgroundColor: '#ffebee',
            border: '1px solid #ffcdd2',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
