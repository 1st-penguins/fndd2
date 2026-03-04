// dev-mode-toggle.js - 개발 모드 토글 기능

import { isDevMode, toggleDevMode } from './config/dev-config.js';

/**
 * 개발 모드 토글 UI 초기화
 */
export function initDevModeToggle() {
  const devModeToggle = document.getElementById('dev-mode-toggle');
  const devModeBtn = document.getElementById('dev-mode-btn');
  
  if (!devModeToggle || !devModeBtn) {
    console.warn('개발 모드 토글 요소를 찾을 수 없습니다.');
    return;
  }
  
  // 로컬 환경에서만 개발 모드 토글 표시
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.hostname === '0.0.0.0';
  
  if (isLocalhost) {
    devModeToggle.style.display = 'block';
  } else {
    devModeToggle.style.display = 'none';
    devModeToggle.remove();
  }
  
  updateDevModeUI();
  
  devModeBtn.addEventListener('click', () => {
    try {
      let devKey = (localStorage.getItem('dev-mode-key') || '').trim();
      if (!devKey) {
        const userKey = (prompt('개발 모드 키를 입력하세요 (키: 4578):') || '').trim();
        if (userKey !== '4578') {
          alert('잘못된 키입니다.');
          return;
        }
        localStorage.setItem('dev-mode-key', '4578');
        // 첫 입력: 키만 저장하고 새로고침 → 새로고침 후 자동으로 개발 모드 ON
      } else {
        toggleDevMode();
      }
      // 에러 나도 새로고침은 실행되도록 setTimeout으로 분리
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (e) {
      console.error('DEV 모드 토글 오류:', e);
      localStorage.setItem('dev-mode-key', '4578');
      setTimeout(() => window.location.reload(), 300);
    }
  });
}

/**
 * 개발 모드 UI 상태 업데이트
 */
function updateDevModeUI() {
  const devModeBtn = document.getElementById('dev-mode-btn');
  if (!devModeBtn) return;
  
  const devKey = (localStorage.getItem('dev-mode-key') || '').trim();
  const hasValidKey = devKey === '4578';
  
  if (isDevMode() && hasValidKey) {
    devModeBtn.classList.add('active');
    devModeBtn.title = '개발 모드 활성화됨 - 로그인 없이 모든 기능 사용 가능';
  } else if (!hasValidKey) {
    devModeBtn.classList.remove('active');
    devModeBtn.title = '개발 모드 키가 필요합니다 - 클릭하여 키 입력';
  } else {
    devModeBtn.classList.remove('active');
    devModeBtn.title = '개발 모드 비활성화됨 - 로그인 필요';
  }
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', initDevModeToggle);
