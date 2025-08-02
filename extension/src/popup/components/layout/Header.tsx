import React from 'react';
import { colors } from '../../styles/theme';

export const Header: React.FC = () => {
  return (
    <>
      {/* Added padding at the top */}
      <div style={{ paddingTop: '16px' }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          color: '#FFFFFF', 
          textAlign: 'center', 
          fontFamily: "'Roboto', 'Arial', sans-serif", 
          fontWeight: 'bold', 
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' 
        }}>
          <span style={{ color: colors.monero.primary }}>Hash</span>ield
        </h2>
      </div>
      
      {/* Monero-themed header accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
        height: '4px',
        background: `linear-gradient(90deg, ${colors.monero.primary} 0%, ${colors.monero.secondary} 100%)`,
        zIndex: 1
      }}></div>
    </>
  );
};
