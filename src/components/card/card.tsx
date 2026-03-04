import React from 'react';
import { CardProps } from './Card.types';
import './Card.css';

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  size = 'medium',
  children,
  className = '',
  onClick,
  ...props
}) => {
  const baseClasses = 'linear-card';
  const variantClasses = `linear-card--${variant}`;
  const sizeClasses = `linear-card--${size}`;
  const interactiveClasses = onClick ? 'linear-card--interactive' : '';
  
  const classes = [baseClasses, variantClasses, sizeClasses, interactiveClasses, className]
    .filter(Boolean)
    .join(' ');

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={classes}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
};

