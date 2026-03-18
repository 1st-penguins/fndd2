// firebase-core.js - Firebase v9 초기화 및 중앙 설정 (동적 로드 최적화)

// Firebase 구성 - 실제 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyBVEYHjLzbitnfpykUO7yjzT_Ye-Dix7pI",
  authDomain: "first-penguins-new.firebaseapp.com",
  projectId: "first-penguins-new",
  storageBucket: "first-penguins-new.firebasestorage.app",
  messagingSenderId: "532317002827",
  appId: "1:532317002827:web:d8ee3b15f269b2571381ce",
  measurementId: "G-WZ34PK12P1"
};

// 관리자 이메일 목록 (중앙 관리)
export const ADMIN_EMAILS = [
  'kspo0324@gmail.com',
  'mingdy7283@gmail.com',
  'sungsoo702@gmail.com',
  'pyogobear@gmail.com'
];

// Firebase 초기화 상태
let app, auth, db;
let initPromise = null;

// 동적으로 Firebase 모듈을 불러와 초기화
export async function ensureFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (app && auth && db) return { app, auth, db };
    try {
      const [{ initializeApp }, { getAuth, setPersistence, browserLocalPersistence }, { getFirestore }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js')
      ]);
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      // redirect/popup 복귀 후 세션 복원을 안정화
      await setPersistence(auth, browserLocalPersistence);
      db = getFirestore(app);
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Firebase v9 동적 초기화 완료');
      }
      return { app, auth, db };
    } catch (error) {
      console.error('Firebase 동적 초기화 오류:', error);
      initPromise = null; // 실패 시 재시도 가능하도록 초기화
      throw error;
    }
  })();

  return initPromise;
}

// 인증 초기화 대기 (로그인 상태 복원 확인)
export async function ensureAuthReady() {
  await ensureFirebase();

  return new Promise((resolve) => {
    // 1. 이미 초기화되었고 사용자 상태가 확인된 경우 (auth.currentUser가 설정됨)
    // 주의: auth.currentUser는 초기화 직후 null일 수 있으므로 이것만으로는 부족함
    // onAuthStateChanged가 최소 1회 실행되었는지 확인하는 플래그가 필요하지만,
    // 간단히 Promise로 감싸서 첫 번째 콜백을 기다리는 것이 가장 확실함.

    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe(); // 리스너 해제 (일회성 확인)
      resolve(user);
    });
  });
}

// 모듈 로드 시 즉시 초기화 시작 (백그라운드)
ensureFirebase().catch(err => console.error("Firebase 자동 초기화 실패:", err));

// 전역 변수 설정 (마이그레이션 기간 동안 이전 코드와의 호환성 유지)
if (typeof window !== 'undefined') {
  Object.defineProperties(window, {
    firebaseApp: { get: () => app, configurable: true },
    auth: { get: () => auth, configurable: true },
    db: { get: () => db, configurable: true }
  });

  // 관리자 이메일 목록 (전역 상수)
  window.ADMIN_EMAILS = ADMIN_EMAILS;

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Firebase 서비스가 전역 객체에 노출되었습니다 (마이그레이션 호환성 유지)');
  }

  // Service Worker 등록 (오프라인 캐시)
  // 로컬 개발 환경에서는 캐시로 인해 최신 스크립트가 반영되지 않는 문제가 잦아 비활성화
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && !isLocalhost) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=' + (document.querySelector('meta[name="app-version"]')?.content || new Date().toISOString().split('T')[0].replace(/-/g, '')))
        .then((registration) => {
          // Service Worker 업데이트 감지
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 새 버전이 설치되었고, 현재 페이지가 제어 중이면 새로고침 제안
                  console.log('새 버전이 사용 가능합니다. 페이지를 새로고침하세요.');
                  // 자동 새로고침 (선택적)
                  // window.location.reload();
                }
              });
            }
          });

          // 주기적으로 업데이트 확인 (1시간마다)
          setInterval(() => {
            registration.update();
          }, 3600000);
        })
        .catch((err) => {
          console.warn('Service Worker 등록 실패:', err);
        });
    });
  } else if ('serviceWorker' in navigator && isLocalhost) {
    // 개발 중에는 기존 SW도 제거해서 캐시 영향 제거
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch((err) => console.warn('로컬 SW 해제 실패:', err));
  }
}

// Firebase 상태 확인용 유틸리티 함수
export function checkFirebaseStatus() {
  return {
    initialized: !!app,
    authReady: !!auth,
    dbReady: !!db
  };
}

// 필요한 객체들 내보내기
export { app, auth, db };