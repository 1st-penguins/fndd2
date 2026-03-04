import React from 'react';

export interface NavigationProps {
  /**
   * 네비게이션의 시각적 스타일 변형
   */
  variant?: 'default' | 'header' | 'footer';
  
  /**
   * 네비게이션 내용
   */
  children: React.ReactNode;
  
  /**
   * 추가 CSS 클래스명
   */
  className?: string;
}

export interface NavigationItemProps {
  /**
   * 네비게이션 아이템 내용
   */
  children: React.ReactNode;
  
  /**
   * 링크 URL
   */
  href?: string;
  
  /**
   * 활성 상태 여부
   */
  active?: boolean;
  
  /**
   * 클릭 핸들러
   */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  
  /**
   * 추가 CSS 클래스명
   */
  className?: string;
}

