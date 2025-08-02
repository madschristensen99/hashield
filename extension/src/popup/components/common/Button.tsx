import React from 'react';
import { commonStyles } from '../../styles/theme';

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'primary',
  fullWidth = false,
  children,
  style = {}
}) => {
  // Determine button style based on variant and disabled state
  const buttonStyle = disabled
    ? commonStyles.button.disabled
    : variant === 'primary'
    ? commonStyles.button.primary
    : commonStyles.button.secondary;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...buttonStyle,
        width: fullWidth ? '100%' : 'auto',
        ...style
      }}
    >
      {children}
    </button>
  );
};
