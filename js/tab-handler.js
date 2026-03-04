// tab-handler.js - 메인 탭 및 서브탭 핸들러

/**
 * 메인 탭 초기화
 */
export function initTabs() {
  // 메인 탭 버튼
  const tabButtons = document.querySelectorAll('.tab-button[data-tab]');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // 학습분석 탭 특별 처리
      if (targetTab === 'analytics-tab') {
        if (typeof window.handleAnalyticsTabClick === 'function') {
          const shouldRedirect = window.handleAnalyticsTabClick();
          if (shouldRedirect) {
            return; // 페이지 이동 시 탭 전환 중단
          }
        }
      }
      
      // 모든 탭 버튼 비활성화
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // 클릭한 탭 버튼 활성화
      button.classList.add('active');
      
      // 모든 탭 콘텐츠 숨김
      const allTabs = document.querySelectorAll('.tab-content');
      allTabs.forEach(tab => tab.classList.remove('active'));
      
      // 선택한 탭 콘텐츠 표시
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * 서브탭 초기화 (문제풀기 탭 내부)
 */
export function initSubTabs() {
  const subTabButtons = document.querySelectorAll('.sub-tab-button[data-subtab]');
  
  subTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetSubTab = button.getAttribute('data-subtab');
      
      // 모든 서브탭 버튼 스타일 초기화
      subTabButtons.forEach(btn => {
        btn.style.background = 'white';
        btn.style.color = 'var(--penguin-navy)';
        btn.classList.remove('active');
      });
      
      // 클릭한 서브탭 버튼 활성화
      button.style.background = 'var(--penguin-navy)';
      button.style.color = 'white';
      button.classList.add('active');
      
      // 모든 서브탭 콘텐츠 숨김
      const allSubTabs = document.querySelectorAll('.sub-tab-content');
      allSubTabs.forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
      });
      
      // 선택한 서브탭 콘텐츠 표시
      const targetContent = document.getElementById(targetSubTab);
      if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
      }
    });
  });
}

/**
 * 페이지 로드 시 초기화
 */
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSubTabs();
    
    // 서브탭 콘텐츠 초기 상태 설정
    const allSubTabs = document.querySelectorAll('.sub-tab-content');
    allSubTabs.forEach(tab => {
      if (!tab.classList.contains('active')) {
        tab.style.display = 'none';
      }
    });
  });
  
  window.initTabs = initTabs;
  window.initSubTabs = initSubTabs;
}

export default {
  initTabs,
  initSubTabs
};

