import React from 'react';
import { useWallet } from '../../context/WalletContext';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';

export const WalletImport: React.FC = () => {
  const { mnemonic, setMnemonic, isImporting, error, importWallet } = useWallet();

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          marginBottom: '5px', 
          color: '#FFFFFF', 
          fontWeight: 'bold' 
        }}>
          Enter 12-word Hashield secret:
          <span
            title="For the demo, use a 12-word seed phrase with testnet funds"
            style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              backgroundColor: '#FF6600',
              color: 'white',
              borderRadius: '50%',
              fontSize: '11px',
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: '16px',
              cursor: 'help',
              userSelect: 'none'
            }}
          >
            ?
          </span>
        </label>
        <textarea
          rows={3}
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value)}
          placeholder="word1 word2 word3 ..."
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
      </div>
      
      <ErrorMessage message={error} />
      
      <Button
        onClick={importWallet}
        disabled={isImporting || !mnemonic.trim()}
        fullWidth
      >
        {isImporting ? 'Importing...' : 'Import Secret'}
      </Button>
    </div>
  );
};
