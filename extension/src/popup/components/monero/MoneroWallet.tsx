import React, { useState, useEffect } from 'react';
import { useMonero } from '../../context/MoneroContext';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { colors } from '../../styles/theme';

interface MoneroBalanceState {
  total: string;
  unlocked: string;
  loading: boolean;
  error: string | null;
}

interface MoneroAddressState {
  address: string;
  loading: boolean;
  error: string | null;
}

interface MoneroSubaddressState {
  label: string;
  creating: boolean;
  address: string | null;
  error: string | null;
}

export const MoneroWallet: React.FC = () => {
  const { moneroWalletInitialized } = useMonero();
  
  // State for Monero wallet data
  const [balance, setBalance] = useState<MoneroBalanceState>({
    total: '0',
    unlocked: '0',
    loading: false,
    error: null
  });
  
  const [address, setAddress] = useState<MoneroAddressState>({
    address: '',
    loading: false,
    error: null
  });
  
  const [subaddress, setSubaddress] = useState<MoneroSubaddressState>({
    label: '',
    creating: false,
    address: null,
    error: null
  });
  
  // Active tab state for Monero wallet sections
  const [activeSection, setActiveSection] = useState<'overview' | 'subaddresses'>('overview');

  // Load Monero wallet data on component mount
  useEffect(() => {
    if (moneroWalletInitialized) {
      loadMoneroAddress();
      loadMoneroBalance();
    }
  }, [moneroWalletInitialized]);

  // Load Monero address
  const loadMoneroAddress = async () => {
    setAddress(prev => ({ ...prev, loading: true, error: null }));
    try {
      console.log('Requesting Monero address from background script...');
      const response = await chrome.runtime.sendMessage({ type: 'getMoneroAddress' });
      console.log('Received Monero address response:', response);
      
      if (response && !response.error && response.address) {
        console.log('Setting valid Monero address:', response.address);
        setAddress({
          address: response.address,
          loading: false,
          error: null
        });
      } else {
        console.error('Invalid Monero address response:', response);
        // If address is empty string or undefined but no error was reported
        if (response && !response.error && !response.address) {
          throw new Error('Monero address is empty. Please try reinitializing the wallet.');
        } else {
          throw new Error(response?.error || 'Failed to load Monero address');
        }
      }
    } catch (err: any) {
      console.error('Error loading Monero address:', err);
      setAddress(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load Monero address'
      }));
    }
  };

  // Load Monero balance
  const loadMoneroBalance = async () => {
    setBalance(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getMoneroBalance' });
      if (response && !response.error) {
        setBalance({
          total: response.balance || '0',
          unlocked: response.unlockedBalance || '0',
          loading: false,
          error: null
        });
      } else {
        throw new Error(response?.error || 'Failed to load Monero balance');
      }
    } catch (err: any) {
      console.error('Error loading Monero balance:', err);
      setBalance(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load Monero balance'
      }));
    }
  };

  // Create a new subaddress
  const createSubaddress = async () => {
    if (!subaddress.label.trim()) {
      setSubaddress(prev => ({
        ...prev,
        error: 'Please enter a label for the subaddress'
      }));
      return;
    }

    setSubaddress(prev => ({ ...prev, creating: true, error: null }));
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'createMoneroSubaddress',
        label: subaddress.label
      });
      
      if (response && !response.error) {
        setSubaddress({
          label: '',
          creating: false,
          address: response.address,
          error: null
        });
      } else {
        throw new Error(response?.error || 'Failed to create subaddress');
      }
    } catch (err: any) {
      console.error('Error creating Monero subaddress:', err);
      setSubaddress(prev => ({
        ...prev,
        creating: false,
        error: err.message || 'Failed to create subaddress'
      }));
    }
  };

  if (!moneroWalletInitialized) {
    return (
      <div style={{ marginTop: '10px' }}>
        <div style={{ 
          padding: '30px 20px',
          backgroundColor: '#1a1a1a',
          border: `2px dashed ${colors.monero.primary}`,
          borderRadius: '8px',
          textAlign: 'center',
          color: colors.text
        }}>
          <div style={{ fontSize: '24px', marginBottom: '15px', color: colors.monero.primary }}>
            <span role="img" aria-label="lock">🔒</span> Monero Wallet
          </div>
          <p style={{ marginBottom: '20px' }}>Your Monero wallet is not initialized yet.</p>
          <Button
            onClick={() => alert('Please import your seed phrase first')}
            variant="primary"
            style={{ padding: '10px 20px' }}
          >
            Initialize Monero Wallet
          </Button>
        </div>
      </div>
    );
  }

  // Section navigation buttons
  const SectionNav = () => (
    <div style={{ 
      display: 'flex', 
      marginBottom: '15px',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #333'
    }}>
      <div 
        onClick={() => setActiveSection('overview')}
        style={{
          flex: 1,
          padding: '10px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: activeSection === 'overview' ? colors.monero.primary : 'transparent',
          color: activeSection === 'overview' ? '#000' : colors.text,
          fontWeight: 'bold',
          transition: 'all 0.2s ease'
        }}
      >
        Overview
      </div>
      <div 
        onClick={() => setActiveSection('subaddresses')}
        style={{
          flex: 1,
          padding: '10px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: activeSection === 'subaddresses' ? colors.monero.primary : 'transparent',
          color: activeSection === 'subaddresses' ? '#000' : colors.text,
          fontWeight: 'bold',
          transition: 'all 0.2s ease'
        }}
      >
        Subaddresses
      </div>
    </div>
  );

  // Monero balance card with prominent display
  const BalanceCard = () => (
    <div style={{ 
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      border: `1px solid ${colors.monero.primary}`,
      position: 'relative'
    }}>
      <div style={{ 
        position: 'absolute', 
        top: '15px', 
        right: '15px',
        opacity: 0.8
      }}>
        <Button
          onClick={loadMoneroBalance}
          disabled={balance.loading}
          variant="secondary"
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          {balance.loading ? '...' : '↻'}
        </Button>
      </div>
      
      <div style={{ marginBottom: '10px', color: colors.text, fontSize: '14px' }}>
        Available Balance
      </div>
      
      <div style={{ 
        fontSize: '28px', 
        fontWeight: 'bold', 
        color: colors.monero.primary,
        marginBottom: '5px',
        display: 'flex',
        alignItems: 'baseline'
      }}>
        {balance.loading ? 'Loading...' : balance.unlocked} 
        <span style={{ fontSize: '16px', marginLeft: '5px' }}>XMR</span>
      </div>
      
      <div style={{ fontSize: '14px', color: '#888' }}>
        Total Balance: {balance.loading ? 'Loading...' : `${balance.total} XMR`}
      </div>
      
      {balance.error && <ErrorMessage message={balance.error} />}
    </div>
  );

  // Monero address display with copy button
  const AddressCard = () => (
    <div style={{ 
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      border: '1px solid #333'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '10px' 
      }}>
        <div style={{ color: colors.text, fontWeight: 'bold' }}>Your Monero Address</div>
        <Button
          onClick={loadMoneroAddress}
          disabled={address.loading}
          variant="secondary"
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          {address.loading ? '...' : '↻'}
        </Button>
      </div>
      
      <div style={{ 
        wordBreak: 'break-all',
        fontSize: '13px',
        fontFamily: 'monospace',
        backgroundColor: '#0d0d0d',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #333',
        color: colors.monero.primary,
        position: 'relative'
      }}>
        {address.loading ? 'Loading...' : address.address || 'Not available'}
        <div 
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            backgroundColor: '#333',
            color: '#fff',
            borderRadius: '4px',
            padding: '3px 6px',
            fontSize: '10px',
            cursor: 'pointer'
          }}
          onClick={() => {
            if (address.address) {
              navigator.clipboard.writeText(address.address);
              alert('Address copied to clipboard!');
            }
          }}
        >
          Copy
        </div>
      </div>
      
      {address.error && <ErrorMessage message={address.error} />}
    </div>
  );

  // Subaddress creation and management
  const SubaddressSection = () => (
    <div style={{ 
      backgroundColor: '#1a1a1a',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #333'
    }}>
      <div style={{ marginBottom: '15px', color: colors.text, fontWeight: 'bold' }}>
        Create New Subaddress
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input
          type="text"
          value={subaddress.label}
          onChange={(e) => setSubaddress(prev => ({ ...prev, label: e.target.value }))}
          placeholder="Enter subaddress label (e.g., 'Donation', 'Shop')"
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #333',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: '#0d0d0d',
            color: colors.text
          }}
        />
        <Button
          onClick={createSubaddress}
          disabled={subaddress.creating || !subaddress.label.trim()}
          variant="primary"
          style={{ padding: '0 20px' }}
        >
          {subaddress.creating ? 'Creating...' : 'Create'}
        </Button>
      </div>
      
      {subaddress.error && <ErrorMessage message={subaddress.error} />}
      
      {subaddress.address && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#0d0d0d', 
          borderRadius: '6px',
          border: '1px solid #333'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: colors.monero.primary, 
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            New Subaddress Created: {subaddress.label}
          </div>
          <div style={{ 
            wordBreak: 'break-all',
            fontSize: '13px',
            fontFamily: 'monospace',
            padding: '10px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            color: colors.text
          }}>
            {subaddress.address}
          </div>
          <div style={{ 
            marginTop: '10px', 
            display: 'flex', 
            justifyContent: 'flex-end' 
          }}>
            <Button
              onClick={() => {
                if (subaddress.address) {
                  navigator.clipboard.writeText(subaddress.address);
                  alert('Subaddress copied to clipboard!');
                }
              }}
              variant="secondary"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Copy Address
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ marginTop: '10px' }}>
      <SectionNav />
      
      {activeSection === 'overview' && (
        <>
          <BalanceCard />
          <AddressCard />
        </>
      )}
      
      {activeSection === 'subaddresses' && (
        <SubaddressSection />
      )}
    </div>
  );
};
