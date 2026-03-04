/**
 * Linear Design System Theme Manager
 * 모든 페이지에서 테마 전환 기능을 제공하는 유틸리티 클래스
 */

class ThemeManager {
  constructor(options = {}) {
    this.currentTheme = this.getInitialTheme();
    this.autoDetect = options.autoDetect !== false; // 기본값: true
    this.saveToStorage = options.saveToStorage !== false; // 기본값: true
    this.animationDuration = options.animationDuration || 300;
    this.callbacks = options.callbacks || {};
    
    this.init();
  }

  /**
   * 초기 테마 결정
   * 1. 저장된 테마 (우선순위 높음)
   * 2. 시스템 다크모드 설정 (autoDetect가 true인 경우)
   * 3. 라이트 테마 (기본값)
   */
  getInitialTheme() {
    if (this.saveToStorage) {
      const savedTheme = localStorage.getItem('linear-theme');
      if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
        return savedTheme;
      }
    }
    
    if (this.autoDetect && window.matchMedia) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    
    return 'light';
  }

  /**
   * 테마 매니저 초기화
   */
  init() {
    this.applyTheme(this.currentTheme);
    this.setupEventListeners();
    
    if (this.callbacks.onInit) {
      this.callbacks.onInit(this.currentTheme);
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 시스템 테마 변경 감지
    if (this.autoDetect && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // 사용자가 수동으로 테마를 선택한 적이 없다면 시스템 설정을 따름
        if (!this.saveToStorage || !localStorage.getItem('linear-theme')) {
          const newTheme = e.matches ? 'dark' : 'light';
          this.applyTheme(newTheme);
          this.updateThemeIcon();
          
          if (this.callbacks.onSystemThemeChange) {
            this.callbacks.onSystemThemeChange(newTheme);
          }
        }
      });
    }

    // 커스텀 테마 변경 이벤트
    window.addEventListener('themeChanged', (e) => {
      if (this.callbacks.onThemeChange) {
        this.callbacks.onThemeChange(e.detail.theme);
      }
    });
  }

  /**
   * 테마 전환
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
    this.updateThemeIcon();
    
    // 애니메이션 효과
    this.addToggleAnimation();
    
    return newTheme;
  }

  /**
   * 특정 테마로 설정
   */
  setTheme(theme) {
    if (!['light', 'dark'].includes(theme)) {
      console.warn(`Invalid theme: ${theme}. Must be 'light' or 'dark'.`);
      return;
    }
    
    this.applyTheme(theme);
    this.updateThemeIcon();
    
    return theme;
  }

  /**
   * 테마 적용
   */
  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    if (this.saveToStorage) {
      localStorage.setItem('linear-theme', theme);
    }
    
    // 커스텀 이벤트 발생
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: theme } 
    }));
    
    if (this.callbacks.onThemeApply) {
      this.callbacks.onThemeApply(theme);
    }
  }

  /**
   * 테마 전환 아이콘 업데이트
   */
  updateThemeIcon() {
    const themeSwitcher = document.getElementById('theme-switcher');
    if (!themeSwitcher) return;

    const icon = themeSwitcher.querySelector('.linear-theme-switcher__icon svg');
    const label = themeSwitcher.querySelector('.linear-theme-switcher__label');
    
    if (icon) {
      if (this.currentTheme === 'light') {
        // 다크 모드 아이콘 (달)
        icon.innerHTML = `
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        `;
      } else {
        // 라이트 모드 아이콘 (태양)
        icon.innerHTML = `
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        `;
      }
    }
    
    if (label) {
      label.textContent = this.currentTheme === 'light' ? '다크 모드' : '라이트 모드';
    }
  }

  /**
   * 테마 전환 애니메이션 추가
   */
  addToggleAnimation() {
    const themeSwitcher = document.getElementById('theme-switcher');
    if (!themeSwitcher) return;

    themeSwitcher.classList.add('linear-theme-switcher--toggling');
    setTimeout(() => {
      themeSwitcher.classList.remove('linear-theme-switcher--toggling');
    }, this.animationDuration);
  }

  /**
   * 테마 전환 버튼 이벤트 바인딩
   */
  bindThemeSwitcher(selector = '#theme-switcher') {
    const themeSwitcher = document.querySelector(selector);
    if (themeSwitcher) {
      themeSwitcher.addEventListener('click', () => this.toggleTheme());
    }
  }

  /**
   * 현재 테마 반환
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * 테마가 다크모드인지 확인
   */
  isDark() {
    return this.currentTheme === 'dark';
  }

  /**
   * 테마가 라이트모드인지 확인
   */
  isLight() {
    return this.currentTheme === 'light';
  }

  /**
   * CSS 변수 값 가져오기
   */
  getCSSVariable(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  }

  /**
   * 테마별 CSS 변수 값 가져오기
   */
  getThemeVariable(variableName) {
    return this.getCSSVariable(variableName);
  }

  /**
   * 디버그 정보 출력
   */
  debug() {
    return {
      currentTheme: this.currentTheme,
      savedTheme: localStorage.getItem('linear-theme'),
      systemDarkMode: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : 'N/A',
      cssVariables: {
        bgPrimary: this.getCSSVariable('--color-bg-primary'),
        textPrimary: this.getCSSVariable('--color-text-primary'),
        borderPrimary: this.getCSSVariable('--color-border-primary')
      }
    };
  }
}

/**
 * 전역 테마 매니저 인스턴스 생성 및 초기화
 */
let globalThemeManager = null;

/**
 * 전역 테마 매니저 초기화 함수
 */
function initThemeManager(options = {}) {
  if (globalThemeManager) {
    return globalThemeManager;
  }
  
  globalThemeManager = new ThemeManager(options);
  return globalThemeManager;
}

/**
 * 전역 테마 매니저 가져오기
 */
function getThemeManager() {
  if (!globalThemeManager) {
    console.warn('ThemeManager not initialized. Call initThemeManager() first.');
    return null;
  }
  return globalThemeManager;
}

/**
 * 간편 테마 전환 함수
 */
function toggleTheme() {
  const manager = getThemeManager();
  if (manager) {
    return manager.toggleTheme();
  }
  return null;
}

/**
 * DOM이 로드되면 자동으로 테마 매니저 초기화
 */
document.addEventListener('DOMContentLoaded', () => {
  // 기본 옵션으로 테마 매니저 초기화
  initThemeManager({
    autoDetect: true,
    saveToStorage: true,
    callbacks: {
      onInit: (theme) => {
        console.log(`Theme initialized: ${theme}`);
      },
      onThemeChange: (theme) => {
        console.log(`Theme changed to: ${theme}`);
      }
    }
  });
  
  // 테마 전환 버튼 자동 바인딩
  const manager = getThemeManager();
  if (manager) {
    manager.bindThemeSwitcher();
  }
});

// 모듈로 내보내기 (ES6 모듈 환경에서 사용)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, initThemeManager, getThemeManager, toggleTheme };
}
