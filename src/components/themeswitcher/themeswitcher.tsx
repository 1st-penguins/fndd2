import React from 'react';
import { ThemeSwitcherProps } from './ThemeSwitcher.types';
import './ThemeSwitcher.css';

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  size = 'medium',
  variant = 'ghost',
  showLabel = false,
  className = '',
  ...props
}) => {
  const [currentTheme, setCurrentTheme] = React.useState(() => {
    // 시스템 설정 또는 저장된 테마 확인
    const savedTheme = localStorage.getItem('linear-theme');
    if (savedTheme) return savedTheme;
    
    // 시스템 다크모드 감지
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  });

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    
    // 테마 변경 적용
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('linear-theme', newTheme);
    
    // 커스텀 이벤트 발생
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: newTheme } 
    }));
  };

  const baseClasses = 'linear-theme-switcher';
  const sizeClasses = `linear-theme-switcher--${size}`;
  const variantClasses = `linear-theme-switcher--${variant}`;
  
  const classes = [baseClasses, sizeClasses, variantClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      onClick={toggleTheme}
      aria-label={`${currentTheme === 'light' ? '다크' : '라이트'} 모드로 전환`}
      title={`${currentTheme === 'light' ? '다크' : '라이트'} 모드로 전환`}
      {...props}
    >
      <div className="linear-theme-switcher__icon">
        {currentTheme === 'light' ? (
          // 다크 모드 아이콘 (달)
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          // 라이트 모드 아이콘 (태양)
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        )}
      </div>
      {showLabel && (
        <span className="linear-theme-switcher__label">
          {currentTheme === 'light' ? '다크' : '라이트'}
        </span>
      )}
    </button>
  );
};
