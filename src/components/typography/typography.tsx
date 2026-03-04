import React from 'react';
import { TypographyProps } from './Typography.types';
import './Typography.css';

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  size,
  weight,
  color,
  children,
  className = '',
  as,
  ...props
}) => {
  // variant에 따라 기본 태그 결정
  const getDefaultTag = (variant: string) => {
    const tagMap: Record<string, keyof JSX.IntrinsicElements> = {
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      h4: 'h4',
      h5: 'h5',
      h6: 'h6',
      body: 'p',
      caption: 'span',
      label: 'label'
    };
    return tagMap[variant] || 'p';
  };

  const Component = as || getDefaultTag(variant);
  
  const baseClasses = 'linear-typography';
  const variantClasses = `linear-typography--${variant}`;
  const sizeClasses = size ? `linear-typography--${size}` : '';
  const weightClasses = weight ? `linear-typography--${weight}` : '';
  const colorClasses = color ? `linear-typography--${color}` : '';
  
  const classes = [baseClasses, variantClasses, sizeClasses, weightClasses, colorClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
};

