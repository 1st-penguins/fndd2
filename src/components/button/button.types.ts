import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 버튼의 시각적 스타일 변형
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  
  /**
   * 버튼의 크기
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * 버튼이 비활성화되었는지 여부
   */
  disabled?: boolean;
  
  /**
   * 버튼 클릭 핸들러
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  
  /**
   * 추가 CSS 클래스명
   */
  className?: string;
  
  /**
   * 버튼 내용
   */
  children: React.ReactNode;
}

