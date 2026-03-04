/**
 * Mock Data for Local Development
 * 데이터베이스 연결 없이 로컬에서 홈페이지를 체험할 수 있는 모의 데이터
 */

window.mockData = {
  // 공지사항 데이터
  notices: [
    {
      id: '1',
      title: '2025년 1월 업데이트 안내',
      content: '새로운 문제들이 추가되었습니다. 2025년 기출문제를 확인해보세요.',
      createdAt: new Date('2025-01-15T10:00:00').toISOString(),
      isPinned: true,
      author: '퍼스트펭귄 팀'
    },
    {
      id: '2',
      title: '시스템 점검 안내',
      content: '1월 20일 오전 2시-4시 시스템 점검이 예정되어 있습니다. 이용에 불편을 드려 죄송합니다.',
      createdAt: new Date('2025-01-14T15:30:00').toISOString(),
      isPinned: true,
      author: '시스템 관리자'
    },
    {
      id: '3',
      title: '새로운 학습 분석 기능 출시',
      content: '더욱 상세한 학습 분석과 개인별 맞춤 추천 기능이 추가되었습니다.',
      createdAt: new Date('2025-01-10T09:15:00').toISOString(),
      isPinned: false,
      author: '개발팀'
    },
    {
      id: '4',
      title: '모의고사 응시 안내',
      content: '2025년 1차 모의고사가 시작되었습니다. 많은 참여 부탁드립니다.',
      createdAt: new Date('2025-01-08T14:20:00').toISOString(),
      isPinned: false,
      author: '운영팀'
    },
    {
      id: '5',
      title: '이용 후기 이벤트',
      content: '서비스 이용 후기를 남겨주시면 추첨을 통해 소정의 상품을 드립니다.',
      createdAt: new Date('2025-01-05T11:45:00').toISOString(),
      isPinned: false,
      author: '마케팅팀'
    }
  ],

  // 과목 데이터
  subjects: [
    { 
      id: '70', 
      name: '운동생리학', 
      code: '70',
      icon: '🧬',
      description: '인체의 운동 시 생리적 반응과 적응 과정'
    },
    { 
      id: '71', 
      name: '건강체력평가', 
      code: '71',
      icon: '💪',
      description: '체력 측정 및 평가 방법론'
    },
    { 
      id: '72', 
      name: '운동처방론', 
      code: '72',
      icon: '📋',
      description: '개인별 맞춤 운동 처방'
    },
    { 
      id: '73', 
      name: '운동부하검사', 
      code: '73',
      icon: '🏃',
      description: '운동 능력 및 한계점 측정'
    },
    { 
      id: '74', 
      name: '운동상해', 
      code: '74',
      icon: '🩹',
      description: '운동 중 발생하는 상해 예방 및 관리'
    },
    { 
      id: '75', 
      name: '기능해부학', 
      code: '75',
      icon: '🦴',
      description: '운동과 관련된 해부학적 구조'
    },
    { 
      id: '76', 
      name: '병태생리학', 
      code: '76',
      icon: '🔬',
      description: '질병의 원인과 진행 과정'
    },
    { 
      id: '77', 
      name: '스포츠심리학', 
      code: '77',
      icon: '🧠',
      description: '운동과 심리학적 요소의 관계'
    }
  ],

  // 연도별 데이터
  years: [
    { 
      year: '2025', 
      passRate: null, 
      subjectCount: 8,
      isLatest: true,
      description: '최신 기출문제'
    },
    { 
      year: '2024', 
      passRate: 9.98, 
      subjectCount: 8,
      isLatest: false,
      description: '합격률: 9.98%'
    },
    { 
      year: '2023', 
      passRate: 30.08, 
      subjectCount: 8,
      isLatest: false,
      description: '합격률: 30.08%'
    },
    { 
      year: '2022', 
      passRate: 10.72, 
      subjectCount: 8,
      isLatest: false,
      description: '합격률: 10.72%'
    },
    { 
      year: '2021', 
      passRate: 23.67, 
      subjectCount: 8,
      isLatest: false,
      description: '합격률: 23.67%'
    },
    { 
      year: '2020', 
      passRate: 15.74, 
      subjectCount: 8,
      isLatest: false,
      description: '합격률: 15.74%'
    },
    { 
      year: '2019', 
      passRate: 26.32, 
      subjectCount: 8,
      isLatest: false,
      description: '합격률: 26.32%'
    }
  ],

  // 모의고사 데이터
  mockExams: [
    {
      id: 'mock-2025',
      year: '2025',
      title: '2025년 1차 모의고사',
      description: '1교시 (80문제) + 2교시 (80문제)',
      passRate: null,
      isLatest: true,
      icon: '📝'
    },
    {
      id: 'mock-2024',
      year: '2024',
      title: '2024년 모의고사',
      description: '1교시 (80문제) + 2교시 (80문제)',
      passRate: 9.98,
      isLatest: false,
      icon: '📝'
    },
    {
      id: 'mock-2023',
      year: '2023',
      title: '2023년 모의고사',
      description: '1교시 (80문제) + 2교시 (80문제)',
      passRate: 30.08,
      isLatest: false,
      icon: '📝'
    }
  ],

  // 사용자 데이터 (로그인 시뮬레이션)
  user: {
    isLoggedIn: false,
    displayName: null,
    email: null,
    uid: null
  },

  // 학습 통계 데이터 (로그인 후 표시)
  learningStats: {
    totalQuestions: 1280,
    answeredQuestions: 342,
    correctAnswers: 287,
    accuracy: 83.9,
    studyDays: 15,
    currentStreak: 5,
    favoriteSubject: '운동생리학'
  }
};

/**
 * Mock API 함수들
 */
window.mockAPI = {
  // 공지사항 가져오기
  getNotices: () => {
    return Promise.resolve(window.mockData.notices);
  },

  // 고정 공지사항 가져오기
  getPinnedNotices: () => {
    return Promise.resolve(window.mockData.notices.filter(notice => notice.isPinned));
  },

  // 과목 목록 가져오기
  getSubjects: () => {
    return Promise.resolve(window.mockData.subjects);
  },

  // 연도별 데이터 가져오기
  getYears: () => {
    return Promise.resolve(window.mockData.years);
  },

  // 모의고사 데이터 가져오기
  getMockExams: () => {
    return Promise.resolve(window.mockData.mockExams);
  },

  // 로그인 시뮬레이션
  signIn: (email, password) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        window.mockData.user = {
          isLoggedIn: true,
          displayName: '테스트 사용자',
          email: email,
          uid: 'mock-user-123'
        };
        resolve(window.mockData.user);
      }, 1000);
    });
  },

  // 로그아웃 시뮬레이션
  signOut: () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        window.mockData.user = {
          isLoggedIn: false,
          displayName: null,
          email: null,
          uid: null
        };
        resolve();
      }, 500);
    });
  },

  // 학습 통계 가져오기
  getLearningStats: () => {
    return Promise.resolve(window.mockData.learningStats);
  }
};

/**
 * Mock Firebase Auth 시뮬레이션
 */
window.mockFirebaseAuth = {
  onAuthStateChanged: (callback) => {
    // 즉시 현재 상태로 콜백 호출
    setTimeout(() => {
      callback(window.mockData.user.isLoggedIn ? window.mockData.user : null);
    }, 100);

    // 상태 변경 시뮬레이션을 위한 리스너
    window.addEventListener('mockAuthStateChange', (e) => {
      callback(e.detail.user);
    });

    return () => {}; // unsubscribe 함수
  },

  signInWithEmailAndPassword: (email, password) => {
    return window.mockAPI.signIn(email, password);
  },

  signOut: () => {
    return window.mockAPI.signOut();
  }
};

/**
 * Mock 데이터 초기화 및 이벤트 설정
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎭 Mock 데이터가 로드되었습니다.');
  console.log('📊 사용 가능한 데이터:', window.mockData);
  console.log('🔧 사용 가능한 API:', window.mockAPI);
  
  // 전역 변수로 설정 (기존 코드와 호환성)
  window.fetchPinnedNotices = window.mockAPI.getPinnedNotices;
  window.fetchNotices = window.mockAPI.getNotices;
  
  // Firebase Auth 모의 객체 설정
  if (typeof window.auth === 'undefined') {
    window.auth = window.mockFirebaseAuth;
  }
});
