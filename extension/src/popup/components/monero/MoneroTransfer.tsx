import React from 'react';
import { useMonero } from '../../context/MoneroContext';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { colors } from '../../styles/theme';

export const MoneroTransfer: React.FC = () => {
  const { 
    transferState, 
    paymentForm, 
    setPaymentForm, 
    resetTransfer, 
    executeMoneroTransfer 
  } = useMonero();
  
  const isFormValid = 
    paymentForm.destinationAddress.trim().length > 0 && 
    paymentForm.amount.trim().length > 0 &&
    !isNaN(parseFloat(paymentForm.amount)) &&
    parseFloat(paymentForm.amount) > 0;
  
  const isTransferInProgress = transferState.status === 'in-progress';
  const isTransferCompleted = transferState.status === 'completed';
  const isTransferError = transferState.status === 'error';
  const isTransferIdle = transferState.status === 'idle';

  return (
    <div style={{ marginTop: '25px' }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '25px',
        border: `1px solid ${colors.monero.primary}`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '8px',
          height: '100%',
          backgroundColor: colors.monero.primary
        }}></div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px',
          paddingLeft: '10px'
        }}>
          <h3 style={{ margin: 0, color: colors.monero.primary, display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', fontSize: '18px' }} role="img" aria-label="send">💸</span>
            Send Monero
          </h3>
        </div>
        
        {isTransferIdle && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: colors.text, 
                fontWeight: 'bold' 
              }}>
                Destination Address
              </label>
              <input
                type="text"
                value={paymentForm.destinationAddress}
                onChange={(e) => setPaymentForm({
                  ...paymentForm,
                  destinationAddress: e.target.value
                })}
                placeholder="Enter Monero address"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#0d0d0d',
                  color: colors.text
                }}
              />
            </div>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: colors.text, 
                fontWeight: 'bold' 
              }}>
                Amount (XMR)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    amount: e.target.value
                  })}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #333',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: '#0d0d0d',
                    color: colors.text,
                    paddingRight: '50px'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#666',
                  fontSize: '14px'
                }}>
                  XMR
                </span>
              </div>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <Button
                onClick={executeMoneroTransfer}
                disabled={!isFormValid}
                variant="primary"
                style={{ 
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: isFormValid ? colors.monero.primary : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isFormValid ? 'pointer' : 'not-allowed',
                  opacity: isFormValid ? 1 : 0.6,
                  transition: 'all 0.2s ease'
                }}
              >
                Send Monero
              </Button>
            </div>
          </div>
        )}
        
        {isTransferInProgress && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              border: `3px solid ${colors.monero.primary}`,
              borderRadius: '50%',
              borderTopColor: 'transparent',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{ marginBottom: '15px', color: colors.text, fontSize: '18px' }}>
              Processing transfer...
            </div>
            <div style={{ fontSize: '28px', color: colors.monero.primary, fontWeight: 'bold' }}>
              {paymentForm.amount} XMR
            </div>
            <div style={{ 
              marginTop: '10px', 
              fontSize: '13px', 
              color: '#888',
              wordBreak: 'break-all',
              maxWidth: '300px',
              margin: '0 auto'
            }}>
              To: {paymentForm.destinationAddress}
            </div>
          </div>
        )}
        
        {isTransferCompleted && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: '#28a745',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              color: '#fff'
            }}>
              ✓
            </div>
            <div style={{ 
              marginBottom: '15px', 
              color: '#28a745',
              fontWeight: 'bold',
              fontSize: '20px'
            }}>
              Transfer Completed!
            </div>
            <div style={{ fontSize: '28px', color: colors.monero.primary, fontWeight: 'bold' }}>
              {paymentForm.amount} XMR
            </div>
            <div style={{ 
              marginTop: '10px', 
              fontSize: '13px', 
              color: '#888',
              wordBreak: 'break-all',
              maxWidth: '300px',
              margin: '0 auto 20px'
            }}>
              To: {paymentForm.destinationAddress}
            </div>
            <Button
              onClick={resetTransfer}
              variant="secondary"
              style={{ 
                padding: '10px 20px',
                borderRadius: '6px'
              }}
            >
              New Transfer
            </Button>
          </div>
        )}
        
        {isTransferError && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: '#dc3545',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              color: '#fff'
            }}>
              !
            </div>
            <div style={{ 
              marginBottom: '15px', 
              color: '#dc3545',
              fontWeight: 'bold',
              fontSize: '20px'
            }}>
              Transfer Failed
            </div>
            <div style={{ 
              backgroundColor: '#2a0d0d', 
              padding: '15px', 
              borderRadius: '6px',
              color: '#f8d7da',
              marginBottom: '20px'
            }}>
              {transferState.error || 'Unknown error occurred'}
            </div>
            <Button
              onClick={resetTransfer}
              variant="secondary"
              style={{ 
                padding: '10px 20px',
                borderRadius: '6px'
              }}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
