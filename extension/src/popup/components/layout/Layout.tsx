import React, { ReactNode, useEffect } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { commonStyles, injectKeyframes } from '../../styles/theme';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Inject keyframes on component mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  return (
    <div style={commonStyles.container}>
      {/* Tech lines */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '0',
        width: '100%',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(6, 214, 160, 0.4), transparent)',
        zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '10%',
        left: '0',
        width: '100%',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(17, 138, 178, 0.4), transparent)',
        zIndex: 0
      }}></div>
      
      {/* Content container with relative positioning to appear above decorative elements */}
      <div style={{
        position: 'relative',
        zIndex: 1
      }}>
        <Header />
        {children}
        <Footer />
      </div>
    </div>
  );
};
