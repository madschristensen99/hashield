import React from 'react';
import { commonStyles } from '../../styles/theme';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, style = {} }) => {
  return (
    <div style={{ ...commonStyles.card, ...style }}>
      {children}
    </div>
  );
};
