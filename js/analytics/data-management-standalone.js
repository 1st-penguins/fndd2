// data-management-standalone.js
// 이 파일을 js/analytics/ 폴더에 추가한 후 HTML에서 로드하세요

// Firebase v9 모듈 API용 함수들을 동적으로 로드하기 위한 코드
let firestoreModule;

// Firestore 모듈을 동적으로 가져오기
async function importFirestoreModule() {
  if (!firestoreModule) {
    try {
      firestoreModule = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
      console.log('Firestore 모듈 동적 로드 성공');
    } catch (error) {
      console.error('Firestore 모듈 로드 오류:', error);
      throw new Error('Firestore 모듈을 로드할 수 없습니다');
    }
  }
  return firestoreModule;
}

/**
 * 사용자의 모든 진행률 데이터를 초기화하는 함수
 */
async function resetAllUserProgress() {
  try {
    showLoading('모든 진행률 데이터 초기화 중...');
    console.log('모든 진행률 데이터 초기화 시작...');
    
    // 현재 사용자 확인
    if (!window.auth) {
      console.error('Auth 서비스가 초기화되지 않았습니다');
      showToast('시스템 오류: Auth 서비스를 찾을 수 없습니다');
      hideLoading();
      return false;
    }
    
    const user = window.auth.currentUser;
    console.log('현재 사용자:', user);
    
    if (!user) {
      showToast('로그인이 필요합니다.');
      hideLoading();
      return false;
    }
    
    // Firestore 모듈 가져오기
    const { doc, updateDoc, serverTimestamp } = await importFirestoreModule();
    
    // 사용자 진행 정보 문서 참조 생성
    const progressRef = doc(window.db, 'userProgress', user.uid);
    console.log('문서 경로:', 'userProgress/' + user.uid);
    
    // 진행 정보 초기화 (yearlyMockExams 구조 완전히 리셋)
    console.log('문서 업데이트 시도...');
    await updateDoc(progressRef, {
      'yearlyMockExams': {},
      'lastUpdated': serverTimestamp()
    });
    console.log('문서 업데이트 성공');
    
    // state 객체 업데이트
    if (window.state && window.state.userProgress) {
      window.state.userProgress.yearlyMockExams = {};
    }
    
    console.log('사용자 진행률 데이터 완전 초기화 완료');
    
    hideLoading();
    showToast('모든 진행률 데이터가 초기화되었습니다.', 'success');
    
    // 학습 진행률 탭 새로고침
    if (typeof window.renderProgressTab === 'function') {
      window.renderProgressTab();
    } else {
      // 없으면 페이지 새로고침
      location.reload();
    }
    
    return true;
  } catch (error) {
    console.error('진행률 데이터 초기화 오류:', error);
    hideLoading();
    showToast(`데이터 초기화 중 오류가 발생했습니다: ${error.message}`);
    return false;
  }
}

/**
 * 특정 연도의 모의고사 진행률 데이터를 초기화하는 함수
 */
async function resetYearlyMockExamProgress(year) {
  try {
    if (!year) {
      console.error('연도가 제공되지 않았습니다');
      return false;
    }
    
    showLoading(`${year}년 모의고사 데이터 초기화 중...`);
    console.log(`${year}년 모의고사 데이터 초기화 시작...`);
    
    // 현재 사용자 확인
    if (!window.auth) {
      console.error('Auth 서비스가 초기화되지 않았습니다');
      showToast('시스템 오류: Auth 서비스를 찾을 수 없습니다');
      hideLoading();
      return false;
    }
    
    const user = window.auth.currentUser;
    console.log('현재 사용자:', user);
    
    if (!user) {
      showToast('로그인이 필요합니다.');
      hideLoading();
      return false;
    }
    
    // Firestore 모듈 가져오기
    const { doc, getDoc, updateDoc, serverTimestamp } = await importFirestoreModule();
    
    // 사용자 진행 정보 문서 참조 생성
    const progressRef = doc(window.db, 'userProgress', user.uid);
    console.log('문서 경로:', 'userProgress/' + user.uid);
    
    // 현재 진행 정보 가져오기
    console.log('문서 조회 시도...');
    const progressDoc = await getDoc(progressRef);
    console.log('문서 조회 결과:', progressDoc);
    
    if (!progressDoc.exists()) {
      hideLoading();
      showToast('진행률 데이터가 없습니다.');
      return false;
    }
    
    // 업데이트 데이터 생성
    const updateData = {};
    updateData[`yearlyMockExams.${year}`] = {};
    updateData['lastUpdated'] = serverTimestamp();
    
    console.log('문서 업데이트 데이터:', updateData);
    
    // Firestore 업데이트
    console.log('문서 업데이트 시도...');
    await updateDoc(progressRef, updateData);
    console.log('문서 업데이트 성공');
    
    // state 객체 업데이트
    if (window.state && window.state.userProgress && window.state.userProgress.yearlyMockExams) {
      window.state.userProgress.yearlyMockExams[year] = {};
    }
    
    console.log(`${year}년 모의고사 진행률 데이터 초기화 완료`);
    
    hideLoading();
    showToast(`${year}년 모의고사 데이터가 초기화되었습니다.`, 'success');
    
    // 학습 진행률 탭 새로고침
    if (typeof window.renderProgressTab === 'function') {
      window.renderProgressTab();
    } else {
      // 없으면 페이지 새로고침
      location.reload();
    }
    
    return true;
  } catch (error) {
    console.error('진행률 데이터 초기화 오류:', error);
    hideLoading();
    showToast(`데이터 초기화 중 오류가 발생했습니다: ${error.message}`);
    return false;
  }
}

/**
 * 데이터베이스와 상태 데이터 동기화 함수
 */
async function syncUserProgressData() {
  try {
    showLoading('데이터 동기화 중...');
    console.log('데이터 동기화 시작...');
    
    // 현재 사용자 확인
    if (!window.auth) {
      console.error('Auth 서비스가 초기화되지 않았습니다');
      showToast('시스템 오류: Auth 서비스를 찾을 수 없습니다');
      hideLoading();
      return false;
    }
    
    const user = window.auth.currentUser;
    console.log('현재 사용자:', user);
    
    if (!user) {
      showToast('로그인이 필요합니다.');
      hideLoading();
      return false;
    }
    
    // Firestore 모듈 가져오기
    const { doc, getDoc } = await importFirestoreModule();
    
    // 사용자 진행 정보 문서 참조 생성
    const progressRef = doc(window.db, 'userProgress', user.uid);
    console.log('문서 경로:', 'userProgress/' + user.uid);
    
    // 최신 진행 정보 가져오기
    console.log('문서 조회 시도...');
    const progressDoc = await getDoc(progressRef);
    console.log('문서 조회 결과:', progressDoc);
    
    if (!progressDoc.exists()) {
      hideLoading();
      showToast('진행률 데이터가 없습니다.');
      return false;
    }
    
    // 실제 데이터베이스 값으로 상태 업데이트
    const progressData = progressDoc.data();
    
    // state 객체 업데이트
    if (window.state) {
      window.state.userProgress = progressData;
    }
    
    console.log('사용자 진행률 데이터 동기화 완료');
    
    hideLoading();
    showToast('데이터가 성공적으로 동기화되었습니다.', 'success');
    
    // 학습 진행률 탭 새로고침
    if (typeof window.renderProgressTab === 'function') {
      window.renderProgressTab();
    } else {
      // 없으면 페이지 새로고침
      location.reload();
    }
    
    return true;
  } catch (error) {
    console.error('데이터 동기화 오류:', error);
    hideLoading();
    showToast(`데이터 동기화 중 오류가 발생했습니다: ${error.message}`);
    return false;
  }
}

// 전역 스코프에 함수 등록
window.resetAllUserProgress = resetAllUserProgress;
window.resetYearlyMockExamProgress = resetYearlyMockExamProgress;
window.syncUserProgressData = syncUserProgressData;

console.log('데이터 관리 함수들이 전역 스코프에 등록되었습니다:', {
  syncUserProgressData: typeof window.syncUserProgressData,
  resetAllUserProgress: typeof window.resetAllUserProgress,
  resetYearlyMockExamProgress: typeof window.resetYearlyMockExamProgress
});

// UI 유틸리티 함수들 (없을 경우 대비)
if (typeof window.showLoading !== 'function') {
  window.showLoading = function(message) {
    console.log('로딩 표시:', message);
    const loaderElement = document.getElementById('dashboard-loader');
    if (loaderElement) {
      loaderElement.textContent = message || '로딩 중...';
      loaderElement.style.display = 'block';
    }
  };
}

if (typeof window.hideLoading !== 'function') {
  window.hideLoading = function() {
    console.log('로딩 숨김');
    const loaderElement = document.getElementById('dashboard-loader');
    if (loaderElement) {
      loaderElement.style.display = 'none';
    }
  };
}

if (typeof window.showToast !== 'function') {
  window.showToast = function(message, type) {
    console.log('토스트 메시지:', message, type);
    alert(message);
  };
}

// 페이지 로드 시 Firebase 초기화 확인
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    try {
      // Firebase 서비스 사용 가능 여부 확인
      if (!window.auth || !window.db) {
        console.warn('Firebase 서비스가 window.auth 또는 window.db에 노출되지 않았습니다.');
        
        // 디버깅을 위한 정보 출력
        console.log('window 객체 내 가능한 Firebase 관련 속성:');
        for (const key of Object.keys(window)) {
          if (key.includes('firebase') || key.includes('Firebase') || 
              key === 'auth' || key === 'db' || key === 'firestore') {
            console.log(`- window.${key}:`, typeof window[key]);
          }
        }
      } else {
        console.log('Firebase 서비스가 정상적으로 로드되었습니다.');
        
        // Firestore 모듈 미리 가져오기 시도
        importFirestoreModule()
          .then(() => console.log('초기 Firestore 모듈 로드 성공'))
          .catch(error => console.error('초기 Firestore 모듈 로드 실패:', error));
      }
    } catch (error) {
      console.error('Firebase 초기화 확인 오류:', error);
    }
  }, 1000); // 1초 지연
});