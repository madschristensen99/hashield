import React from 'react';
import { commonStyles } from '../../styles/theme';

interface ErrorMessageProps {
  message: string;
  style?: React.CSSProperties;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, style = {} }) => {
  if (!message) return null;
  
  return (
    <div style={{ ...commonStyles.errorMessage, ...style }}>
      {message}
    </div>
  );
};
