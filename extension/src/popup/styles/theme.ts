// Theme colors and styles for the HashShield extension
export const colors = {
  background: '#0A0F1F',
  primary: '#06D6A0',   // Bright cyan for primary actions
  secondary: '#FFD166', // Warm yellow for secondary elements
  accent: '#118AB2',    // Blue for accents
  warning: '#FF6B6B',   // Soft red for warnings
  text: '#FFFFFF',      // White text
  textDark: '#333333',  // Dark text for light backgrounds
  monero: {
    primary: '#FF6600', // Monero orange
    secondary: '#FF8C00' // Lighter orange
  }
};

// Animation keyframes
export const keyframes = {
  float: `
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
  `,
  spin: `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `,
  glow: `
    @keyframes glow {
      0% { box-shadow: 0 0 5px #06D6A0; }
      50% { box-shadow: 0 0 20px #06D6A0, 0 0 30px #118AB2; }
      100% { box-shadow: 0 0 5px #06D6A0; }
    }
  `,
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }
  `
};

// Common component styles
export const commonStyles = {
  container: {
    width: '360px',
    minHeight: '500px',
    padding: '20px',
    boxSizing: 'border-box' as const,
    fontFamily: "'Roboto', 'Arial', sans-serif",
    backgroundColor: '#101010',
    color: '#FFFFFF',
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: '8px',
    borderLeft: `4px solid ${colors.monero.primary}`,
  },
  button: {
    primary: {
      padding: '10px',
      backgroundColor: colors.monero.primary,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.2s ease'
    },
    secondary: {
      padding: '10px',
      backgroundColor: colors.accent,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.2s ease'
    },
    disabled: {
      padding: '10px',
      backgroundColor: '#333333',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'not-allowed',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.2s ease'
    }
  },
  card: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#ffffff'
  },
  errorMessage: {
    color: 'red', 
    fontSize: '12px', 
    marginBottom: '10px',
    padding: '8px',
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '4px'
  }
};

// Inject keyframes into document head
export const injectKeyframes = () => {
  const style = document.createElement('style');
  style.textContent = Object.values(keyframes).join('\n');
  document.head.appendChild(style);
};
