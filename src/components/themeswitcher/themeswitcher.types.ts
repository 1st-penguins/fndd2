import React from 'react';

export interface ThemeSwitcherProps {
  /**
   * 테마 전환 버튼의 크기
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * 테마 전환 버튼의 시각적 스타일 변형
   */
  variant?: 'ghost' | 'outline' | 'primary' | 'secondary';
  
  /**
   * 라벨 표시 여부
   */
  showLabel?: boolean;
  
  /**
   * 추가 CSS 클래스명
   */
  className?: string;
  
  /**
   * 클릭 핸들러 (기본 토글 동작 외에 추가 동작)
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>, theme: 'light' | 'dark') => void;
}
