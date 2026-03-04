import React from 'react';
import { NavigationItemProps } from './Navigation.types';
import './NavigationItem.css';

export const NavigationItem: React.FC<NavigationItemProps> = ({
  children,
  href,
  active = false,
  onClick,
  className = '',
  ...props
}) => {
  const baseClasses = 'linear-navigation__item';
  const activeClasses = active ? 'linear-navigation__item--active' : '';
  
  const classes = [baseClasses, activeClasses, className]
    .filter(Boolean)
    .join(' ');

  const Component = href ? 'a' : 'button';

  return (
    <li className={classes}>
      <Component
        className="linear-navigation__link"
        href={href}
        onClick={onClick}
        {...props}
      >
        {children}
      </Component>
    </li>
  );
};

