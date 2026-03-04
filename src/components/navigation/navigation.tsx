import React from 'react';
import { NavigationProps } from './Navigation.types';
import './Navigation.css';

export const Navigation: React.FC<NavigationProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'linear-navigation';
  const variantClasses = `linear-navigation--${variant}`;
  
  const classes = [baseClasses, variantClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <nav className={classes} {...props}>
      {children}
    </nav>
  );
};

