// ui-utils.js - 일반 UI 유틸리티 함수

/**
 * 간단한 모달 표시
 * @param {string} title - 모달 제목
 * @param {string} content - 모달 내용
 * @param {function} [onClose] - 닫기 콜백 함수
 * @returns {HTMLElement} 모달 요소
 */
export function showModal(title, content, onClose) {
  // 이미 존재하는 모달 제거
  const existingModal = document.querySelector('.simple-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 모달 컨테이너 생성
  const modalContainer = document.createElement('div');
  modalContainer.className = 'simple-modal-container';
  
  // 모달 HTML
  modalContainer.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-content">
        <span class="simple-modal-close">&times;</span>
        <h3 class="simple-modal-title">${title}</h3>
        <div class="simple-modal-body">${content}</div>
        <div class="simple-modal-footer">
          <button class="simple-modal-button">확인</button>
        </div>
      </div>
    </div>
  `;
  
  // 모달 스타일 추가
  addModalStyles();
  
  // body에 추가
  document.body.appendChild(modalContainer);
  
  // 이벤트 리스너 등록
  const modal = modalContainer.querySelector('.simple-modal');
  const closeButton = modalContainer.querySelector('.simple-modal-close');
  const confirmButton = modalContainer.querySelector('.simple-modal-button');
  
  // 닫기 버튼 이벤트
  const closeModal = () => {
    modalContainer.remove();
    if (typeof onClose === 'function') {
      onClose();
    }
  };
  
  closeButton.addEventListener('click', closeModal);
  confirmButton.addEventListener('click', closeModal);
  
  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      closeModal();
    }
  });
  
  return modalContainer;
}

/**
 * 확인/취소 모달 표시
 * @param {string} title - 모달 제목
 * @param {string} content - 모달 내용
 * @param {function} onConfirm - 확인 콜백 함수
 * @param {function} [onCancel] - 취소 콜백 함수
 * @returns {HTMLElement} 모달 요소
 */
export function showConfirmModal(title, content, onConfirm, onCancel) {
  // 이미 존재하는 모달 제거
  const existingModal = document.querySelector('.simple-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 모달 컨테이너 생성
  const modalContainer = document.createElement('div');
  modalContainer.className = 'simple-modal-container';
  
  // 모달 HTML
  modalContainer.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-content">
        <span class="simple-modal-close">&times;</span>
        <h3 class="simple-modal-title">${title}</h3>
        <div class="simple-modal-body">${content}</div>
        <div class="simple-modal-footer">
          <button class="simple-modal-button cancel-button">취소</button>
          <button class="simple-modal-button confirm-button">확인</button>
        </div>
      </div>
    </div>
  `;
  
  // 모달 스타일 추가
  addModalStyles();
  
  // body에 추가
  document.body.appendChild(modalContainer);
  
  // 이벤트 리스너 등록
  const modal = modalContainer.querySelector('.simple-modal');
  const closeButton = modalContainer.querySelector('.simple-modal-close');
  const cancelButton = modalContainer.querySelector('.cancel-button');
  const confirmButton = modalContainer.querySelector('.confirm-button');
  
  // 콜백 함수 실행 및 모달 닫기
  const handleConfirm = () => {
    modalContainer.remove();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  };
  
  const handleCancel = () => {
    modalContainer.remove();
    if (typeof onCancel === 'function') {
      onCancel();
    }
  };
  
  closeButton.addEventListener('click', handleCancel);
  cancelButton.addEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  
  // 모달 외부 클릭 시 취소
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      handleCancel();
    }
  });
  
  return modalContainer;
}

/**
 * 모달 스타일 추가
 */
function addModalStyles() {
  // 이미 스타일이 있는지 확인
  if (document.getElementById('simple-modal-styles')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'simple-modal-styles';
  styleElement.textContent = `
    .simple-modal-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
    }
    
    .simple-modal {
      display: flex;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      justify-content: center;
      align-items: center;
      z-index: 1001;
    }
    
    .simple-modal-content {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      max-width: 500px;
      width: 90%;
      position: relative;
    }
    
    .simple-modal-close {
      position: absolute;
      top: 10px;
      right: 15px;
      font-size: 24px;
      cursor: pointer;
    }
    
    .simple-modal-title {
      margin-top: 0;
      margin-bottom: 15px;
      color: #333;
    }
    
    .simple-modal-body {
      margin-bottom: 20px;
    }
    
    .simple-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .simple-modal-button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .cancel-button {
      background-color: #f5f5f5;
      color: #333;
    }
    
    .confirm-button {
      background-color: #4285F4;
      color: white;
    }
  `;
  document.head.appendChild(styleElement);
}

/**
 * 토스트 메시지 표시
 * @param {string} message - 메시지 내용
 * @param {string} [type='info'] - 메시지 타입 (info, success, error, warning)
 * @param {number} [duration=3000] - 표시 시간 (ms)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // 이미 존재하는 토스트 제거
  const existingToast = document.querySelector('.toast-message');
  if (existingToast) {
    existingToast.remove();
  }

  // 토스트 스타일 추가
  addToastStyles();
  
  // 토스트 메시지 요소 생성
  const toast = document.createElement('div');
  toast.className = `toast-message ${type}`;
  toast.textContent = message;
  
  // body에 추가
  document.body.appendChild(toast);
  
  // 애니메이션 적용
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 지정된 시간 후 제거
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * 토스트 스타일 추가
 */
function addToastStyles() {
  // 이미 스타일이 있는지 확인
  if (document.getElementById('toast-styles')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'toast-styles';
  styleElement.textContent = `
    .toast-message {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 8px;
      background-color: rgba(51, 51, 51, 0.9);
      color: white;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.3s ease;
      z-index: 9999;
      max-width: 90%;
    }
    
    .toast-message.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .toast-message.success {
      background-color: rgba(76, 175, 80, 0.9);
    }
    
    .toast-message.error {
      background-color: rgba(244, 67, 54, 0.9);
    }
    
    .toast-message.warning {
      background-color: rgba(255, 152, 0, 0.9);
    }
    
    .toast-message.info {
      background-color: rgba(33, 150, 243, 0.9);
    }
    
    @media (max-width: 768px) {
      .toast-message {
        left: 50%;
        right: auto;
        transform: translateX(-50%) translateY(30px);
        width: 80%;
      }
      
      .toast-message.show {
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(styleElement);
}

/**
 * 로딩 스피너 표시
 * @param {string} [containerId] - 컨테이너 ID (없으면 전체 화면)
 * @param {string} [message='로딩 중...'] - 로딩 메시지
 * @returns {Object} 스피너 제어 객체
 */
export function showSpinner(containerId, message = '로딩 중...') {
  // 스피너 스타일 추가
  addSpinnerStyles();
  
  // 스피너 요소 생성
  const spinner = document.createElement('div');
  spinner.className = containerId ? 'spinner-container' : 'spinner-overlay';
  spinner.innerHTML = `
    <div class="spinner-content">
      <div class="spinner"></div>
      <p class="spinner-message">${message}</p>
    </div>
  `;
  
  // 컨테이너에 추가 또는 body에 추가
  let container;
  if (containerId) {
    container = document.getElementById(containerId);
    if (container) {
      container.appendChild(spinner);
    } else {
      document.body.appendChild(spinner);
    }
  } else {
    document.body.appendChild(spinner);
  }
  
  // 스피너 제어 객체
  return {
    stop: () => {
      spinner.remove();
    },
    updateMessage: (newMessage) => {
      const messageElement = spinner.querySelector('.spinner-message');
      if (messageElement) {
        messageElement.textContent = newMessage;
      }
    }
  };
}

/**
 * 스피너 스타일 추가
 */
function addSpinnerStyles() {
  // 이미 스타일이 있는지 확인
  if (document.getElementById('spinner-styles')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'spinner-styles';
  styleElement.textContent = `
    .spinner-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .spinner-container {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    }
    
    .spinner-content {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #4285F4;
      animation: spin 1s linear infinite;
    }
    
    .spinner-message {
      margin-top: 15px;
      color: #333;
      font-size: 14px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
}

/**
 * 페이지 상단으로 부드럽게 스크롤
 */
export function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

/**
 * 특정 요소로 부드럽게 스크롤
 * @param {string} elementId - 요소 ID
 * @param {number} [offset=0] - 추가 오프셋 (px)
 */
export function scrollToElement(elementId, offset = 0) {
  const element = document.getElementById(elementId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

/**
 * 스크롤 업 버튼 추가
 * @param {number} [showAfter=300] - 이 픽셀 이후에 버튼 표시
 */
export function addScrollUpButton(showAfter = 300) {
  // 이미 존재하는 버튼 확인
  if (document.getElementById('scroll-up-button')) {
    return;
  }
  
  // 버튼 요소 생성
  const button = document.createElement('button');
  button.id = 'scroll-up-button';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 14L12 8L18 14"></path>
    </svg>
  `;
  button.title = '맨 위로 이동';
  button.setAttribute('aria-label', '맨 위로 이동');
  
  // 버튼 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
    #scroll-up-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 16px;
      background:
        linear-gradient(160deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05)),
        rgba(15, 23, 42, 0.55);
      color: #e2e8f0;
      border: 1px solid rgba(148, 163, 184, 0.38);
      cursor: pointer;
      display: grid;
      place-items: center;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(10px) scale(0.92);
      transition: opacity 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
      z-index: 999;
      box-shadow: 0 14px 34px rgba(2, 6, 23, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.16);
      -webkit-backdrop-filter: blur(14px) saturate(140%);
      backdrop-filter: blur(14px) saturate(140%);
    }

    #scroll-up-button svg {
      width: 22px;
      height: 22px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    #scroll-up-button.visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    
    #scroll-up-button:hover {
      background:
        linear-gradient(160deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.08)),
        rgba(15, 23, 42, 0.68);
      box-shadow: 0 18px 38px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.26);
      transform: translateY(-2px) scale(1.04);
    }

    #scroll-up-button:active {
      transform: translateY(0) scale(0.97);
    }

    #scroll-up-button:focus-visible {
      outline: 2px solid rgba(125, 211, 252, 0.85);
      outline-offset: 3px;
    }

    @media (max-width: 768px) {
      #scroll-up-button {
        bottom: 16px;
        right: 16px;
        width: 46px;
        height: 46px;
        border-radius: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #scroll-up-button {
        transition: opacity 0.1s ease;
        transform: none;
      }

      #scroll-up-button.visible,
      #scroll-up-button:hover,
      #scroll-up-button:active {
        transform: none;
      }
    }

    @supports not ((-webkit-backdrop-filter: blur(2px)) or (backdrop-filter: blur(2px))) {
      #scroll-up-button {
        background: rgba(15, 23, 42, 0.94);
      }
    }
  `;
  
  // 요소 추가
  document.head.appendChild(style);
  document.body.appendChild(button);
  
  // 클릭 이벤트
  button.addEventListener('click', scrollToTop);
  
  // 스크롤 이벤트
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > showAfter) {
      button.classList.add('visible');
    } else {
      button.classList.remove('visible');
    }
  });
}

// 전역 이미지 지연 로딩 활성화
export function enableGlobalLazyLoading() {
  // 상점 카드 이미지는 제외 (크기 계산 문제 방지)
  function shouldSkip(img) {
    return img.closest('.shop-card') || img.closest('.shop-grid');
  }

  // 기존 img에 loading/fetchpriority/decoding 적용
  document.querySelectorAll('img').forEach(img => {
    if (shouldSkip(img)) return;
    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // 동적 이미지도 감지하여 적용
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === 'IMG') {
            if (!shouldSkip(node)) {
              if (!node.hasAttribute('loading')) node.setAttribute('loading', 'lazy');
              if (!node.hasAttribute('fetchpriority')) node.setAttribute('fetchpriority', 'low');
              if (!node.hasAttribute('decoding')) node.setAttribute('decoding', 'async');
            }
          } else {
            node.querySelectorAll?.('img').forEach(img => {
              if (!shouldSkip(img)) {
                if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
                if (!img.hasAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
                if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
                }
            });
          }
        }
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

// 전역 함수로 노출 (마이그레이션 호환성 유지)
if (typeof window !== 'undefined') {
  window.showModal = showModal;
  window.showConfirmModal = showConfirmModal;
  window.showToast = showToast;
  window.showSpinner = showSpinner;
  window.scrollToTop = scrollToTop;
  window.scrollToElement = scrollToElement;
  window.addScrollUpButton = addScrollUpButton;
  window.enableGlobalLazyLoading = enableGlobalLazyLoading;
}

/**
 * 로딩 표시 함수 - 개선된 버전
 * @param {string} message - 로딩 메시지 (선택사항)
 */
export function showLoading(message = '로딩 중...') {
  // 기존 로딩 요소 찾기
  let loader = document.getElementById('dashboard-loader');
  
  // 로더가 없으면 새로 생성
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'dashboard-loader';
    loader.className = 'dashboard-loader';
    
    // 대시보드 컨테이너에 추가 (있는 경우)
    const dashboard = document.getElementById('analytics-dashboard');
    if (dashboard) {
      dashboard.insertBefore(loader, dashboard.firstChild);
    } else {
      document.body.appendChild(loader);
    }
  }
  
  // 메시지 설정 및 표시
  loader.setAttribute('data-message', message);
  loader.style.display = 'flex';
  
  // 페이드 인 애니메이션
  loader.style.opacity = '0';
  loader.style.transition = 'opacity 0.3s ease';
  setTimeout(() => {
    loader.style.opacity = '1';
  }, 10);
}

/**
 * 로딩 숨김 함수 - 개선된 버전
 */
export function hideLoading() {
  const loader = document.getElementById('dashboard-loader');
  if (loader) {
    // 페이드 아웃 애니메이션
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }
}

/**
 * 오류 메시지 표시
 * @param {string} message - 오류 메시지
 * @param {string} type - 오류 유형 ('error', 'warning', 'info')
 */
export function showError(message, type = 'error') {
  // 기존 오류 요소 찾기
  let errorElement = document.getElementById('dashboard-error');
  
  // 없으면 새로 생성
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.id = 'dashboard-error';
    errorElement.className = 'dashboard-error';
    document.body.appendChild(errorElement);
  }
  
  // 유형에 따른 클래스 설정
  errorElement.className = `dashboard-error ${type}`;
  
  // 메시지 설정 및 표시
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  // 5초 후 자동으로 숨기기
  setTimeout(() => {
    errorElement.style.display = 'none';
  }, 5000);
}

export default {
  showModal,
  showConfirmModal,
  showToast,
  showSpinner,
  scrollToTop,
  scrollToElement,
  addScrollUpButton,
  enableGlobalLazyLoading,
  showLoading,
  hideLoading,
  showError
};