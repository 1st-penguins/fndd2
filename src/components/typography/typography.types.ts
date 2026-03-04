import React from 'react';

export interface TypographyProps {
  /**
   * 타이포그래피의 변형 (헤딩, 본문, 캡션 등)
   */
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'caption' | 'label';
  
  /**
   * 텍스트 크기 (variant보다 우선순위가 높음)
   */
  size?: 'tiny' | 'micro' | 'mini' | 'small' | 'regular' | 'large' | 'title1' | 'title2' | 'title3' | 'title4' | 'title5' | 'title6' | 'title7' | 'title8' | 'title9';
  
  /**
   * 폰트 굵기
   */
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  
  /**
   * 텍스트 색상
   */
  color?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'brand' | 'accent' | 'success' | 'warning' | 'error';
  
  /**
   * 타이포그래피 내용
   */
  children: React.ReactNode;
  
  /**
   * 추가 CSS 클래스명
   */
  className?: string;
  
  /**
   * 렌더링할 HTML 태그 (variant보다 우선순위가 높음)
   */
  as?: keyof JSX.IntrinsicElements;
}

