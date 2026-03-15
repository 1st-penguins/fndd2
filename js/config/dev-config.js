// dev-config.js - 개발 환경 설정
// 로컬 개발 시 Firebase 연동 없이 모든 기능을 테스트할 수 있도록 하는 설정

// dev-mode 키의 SHA-256 해시 (평문 키는 소스에 포함하지 않음)
export const DEV_KEY_HASH = '243b8a8b497f312601438c161449961cad5dbc3baf3704c16c0d2ab44c3be5df';

/**
 * 입력된 키를 SHA-256 해시하여 검증 후 localStorage에 해시값 저장
 * @param {string} input - 사용자가 입력한 키
 * @returns {Promise<boolean>} 유효한 키인지 여부
 */
export async function validateAndStoreDevKey(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  if (hashHex === DEV_KEY_HASH) {
    localStorage.setItem('dev-mode-key', hashHex);
    return true;
  }
  return false;
}

/**
 * 개발 모드 설정
 * 로컬 개발 시 true로 설정하여 로그인 없이 모든 기능 사용 가능
 */
export const DEV_CONFIG = {
  // 개발 모드 활성화 여부 (로컬 환경에서만 true)
  isDevMode: (typeof window !== 'undefined' && 
              (window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' || 
               window.location.hostname === '0.0.0.0' ||
               window.location.hostname === '::1')),
  
  // 개발 모드에서 사용할 가짜 사용자 정보
  mockUser: {
    uid: 'dev-user-123',
    email: 'dev@firstpenguin.com',
    displayName: '개발자',
    isAdmin: true
  },
  
  // 개발 모드에서 비활성화할 기능들
  disabledFeatures: {
    // Firebase 인증 비활성화
    disableAuth: true,
    // 로그인 필요 모달 비활성화
    disableLoginRequired: true,
    // 실제 Firebase 연동 비활성화
    disableFirebase: true
  },
  
  // 개발 모드에서 사용할 가짜 데이터
  mockData: {
    notices: [
      {
        id: 'dev-notice-1',
        title: '[개발 모드] 공지사항 테스트',
        content: '개발 모드에서 표시되는 테스트 공지사항입니다.',
        createdAt: new Date().toISOString(),
        isImportant: true
      }
    ],
    quizData: {
      subjects: [
        { id: '건강체력평가', name: '건강체력평가', year: '2025' },
        { id: '기능해부학', name: '기능해부학', year: '2025' },
        { id: '병태생리학', name: '병태생리학', year: '2025' }
      ]
    }
  }
};

/**
 * URL에 테스트/개발용 파라미터가 있는지 확인 (?test=1 또는 ?dev=1, 로컬에서만)
 * 로컬에서 로그인 없이 문제풀이/과목 페이지 테스트 시 사용 (다른 관리자 참고용).
 */
function hasTestParam() {
  if (typeof window === 'undefined') return false;
  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '0.0.0.0' ||
                      window.location.hostname === '::1';
  if (!isLocalhost) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === '1' || params.get('dev') === '1';
}

/**
 * 개발 모드 확인 함수
 * - 로컬 + ?test=1 또는 ?dev=1 → 키 없이 개발 모드 (로컬 테스트용)
 * - 로컬 + localStorage dev-mode-key 4578 + 토글 ON → 개발 모드
 */
export function isDevMode() {
  if (typeof window === 'undefined') return false;

  // 사용자가 명시적으로 끈 상태
  if (localStorage.getItem('devModeOff') === 'true') return false;

  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '0.0.0.0' ||
                      window.location.hostname === '::1';

  if (!isLocalhost) return false;

  if (hasTestParam()) return true;

  const devKey = (localStorage.getItem('dev-mode-key') || '').trim();
  const hasValidDevKey = devKey === DEV_KEY_HASH;

  return DEV_CONFIG.isDevMode && hasValidDevKey;
}

/**
 * 개발 모드에서 가짜 사용자 정보 반환
 */
export function getMockUser() {
  return DEV_CONFIG.mockUser;
}

/**
 * 개발 모드에서 가짜 데이터 반환
 */
export function getMockData(type) {
  return DEV_CONFIG.mockData[type] || null;
}

/**
 * 개발 모드 토글 (런타임에서 변경 가능)
 */
export function toggleDevMode() {
  const currentlyOn = isDevMode();
  if (currentlyOn) {
    // 끄기: localStorage에 off 저장
    localStorage.setItem('devModeOff', 'true');
    DEV_CONFIG.isDevMode = false;
  } else {
    // 켜기: off 플래그 제거
    localStorage.removeItem('devModeOff');
    DEV_CONFIG.isDevMode = true;
  }
  const nowOn = !currentlyOn;
  console.log(`개발 모드가 ${nowOn ? '활성화' : '비활성화'}되었습니다.`);
  return nowOn;
}

// 전역 객체에 개발 모드 설정 노출
if (typeof window !== 'undefined') {
  window.DEV_CONFIG = DEV_CONFIG;
  window.isDevMode = isDevMode;
  window.getMockUser = getMockUser;
  window.getMockData = getMockData;
  window.toggleDevMode = toggleDevMode;
}
