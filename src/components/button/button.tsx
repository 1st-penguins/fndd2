import React from 'react';
import { ButtonProps } from './Button.types';
import './Button.css';

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  disabled = false,
  onClick,
  className = '',
  ...props
}) => {
  const baseClasses = 'linear-button';
  const variantClasses = `linear-button--${variant}`;
  const sizeClasses = `linear-button--${size}`;
  const disabledClasses = disabled ? 'linear-button--disabled' : '';
  
  const classes = [baseClasses, variantClasses, sizeClasses, disabledClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

