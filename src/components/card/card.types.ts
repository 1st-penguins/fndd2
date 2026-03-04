import React from 'react';

export interface CardProps {
  /**
   * 카드의 시각적 스타일 변형
   */
  variant?: 'default' | 'feature' | 'outlined' | 'elevated';
  
  /**
   * 카드의 크기
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * 카드 내용
   */
  children: React.ReactNode;
  
  /**
   * 추가 CSS 클래스명
   */
  className?: string;
  
  /**
   * 카드 클릭 핸들러 (클릭 가능한 카드로 만듦)
   */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

