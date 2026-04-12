// certificate-utils.js - 자격증 관련 유틸리티 함수 (CERT_REGISTRY 기반)

/**
 * 자격증 중앙 레지스트리 (Single Source of Truth)
 * 새 자격증 추가 시 여기에 객체 1개만 추가하면 됨
 */
export const CERT_REGISTRY = {
  'health-manager': {
    name: '건강운동관리사',
    shortName: '건운사',
    emoji: '🏋️',
    color: { primary: '#1D2F4E', dark: '#162740', light: '#2a4570' },
    folderSuffix: '',
    hasSessionSplit: true,
    subjects: {
      session1: ['운동생리학', '건강체력평가', '운동처방론', '운동부하검사'],
      session2: ['운동상해', '기능해부학', '병태생리학', '스포츠심리학']
    },
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    examDuration: 80,
    questionsPerSubject: 20,
    passCriteria: { perSubject: 40, total: 60 }
  },

  'sports-instructor': {
    name: '2급 스포츠지도사',
    shortName: '2급스포츠',
    emoji: '⚽',
    color: { primary: '#047D5A', dark: '#036348', light: '#0A9E72' },
    folderSuffix: '-sports',
    hasSessionSplit: true,
    subjects: {
      session1: ['스포츠사회학', '스포츠윤리', '스포츠심리학', '운동생리학'],
      session2: ['운동역학', '체육측정평가론', '한국체육사', '스포츠교육학']
    },
    years: [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    examDuration: 80,
    questionsPerSubject: 20,
    passCriteria: { perSubject: 40, total: 60 }
  },

  'sports-instructor-1': {
    name: '1급 스포츠지도사',
    shortName: '1급',
    emoji: '🏅',
    color: { primary: '#4E3278', dark: '#3F2662', light: '#6B4D96' },
    folderSuffix: '-sports1',
    hasSessionSplit: false,
    subjects: {
      all: ['운동상해', '체육측정평가론', '트레이닝론', '스포츠영양학', '건강교육론', '장애인스포츠론']
    },
    subjectCodes: {
      '스포츠영양학': '00', '운동상해': '11', '체육측정평가론': '22',
      '트레이닝론': '33', '건강교육론': '44', '장애인스포츠론': '55'
    },
    years: [2021, 2022, 2023, 2024, 2025],
    examDuration: 80,
    questionsPerSubject: 20,
    passCriteria: { perSubject: 40, total: 60 }
  }
};

/**
 * 등록된 모든 자격증 키 반환
 */
export function getAllCertTypes() {
  return Object.keys(CERT_REGISTRY);
}

/**
 * 자격증의 전체 과목 목록 반환 (교시 유무 자동 대응)
 */
export function getAllSubjects(type) {
  const config = CERT_REGISTRY[type];
  if (!config) return [];
  if (config.hasSessionSplit) {
    return [...config.subjects.session1, ...config.subjects.session2];
  }
  return config.subjects.all || [];
}

/**
 * 경로에서 자격증 타입 감지 (folderSuffix 길이 내림차순 매칭)
 * '-sports1'을 '-sports'보다 먼저 매칭
 */
function detectCertFromPath(path) {
  const entries = Object.entries(CERT_REGISTRY)
    .filter(([_, c]) => c.folderSuffix !== '')
    .sort((a, b) => b[1].folderSuffix.length - a[1].folderSuffix.length);

  for (const [certType, config] of entries) {
    if (path.includes(config.folderSuffix + '/')) {
      return certType;
    }
  }
  return null;
}

/**
 * 현재 페이지의 자격증 타입 감지
 */
export function getCurrentCertificateType() {
  // 1. URL 파라미터 확인
  const urlParams = new URLSearchParams(window.location.search);
  const urlCert = urlParams.get('cert');
  if (urlCert && CERT_REGISTRY[urlCert]) {
    localStorage.setItem('selectedCertificate', urlCert);
    return urlCert;
  }

  // 2. 경로 기반 감지 (레지스트리 기반)
  const path = window.location.pathname;
  const detected = detectCertFromPath(path);
  if (detected) {
    localStorage.setItem('selectedCertificate', detected);
    return detected;
  }

  // 3. localStorage 확인 (currentCertificateType 우선)
  const currentStored = localStorage.getItem('currentCertificateType');
  if (currentStored && CERT_REGISTRY[currentStored]) {
    return currentStored;
  }

  const stored = localStorage.getItem('selectedCertificate');
  if (stored && CERT_REGISTRY[stored]) {
    return stored;
  }

  // 4. 기본값 (건강운동관리사)
  return 'health-manager';
}

/**
 * 자격증 타입 설정
 */
export function setCertificateType(type) {
  if (!CERT_REGISTRY[type]) {
    console.warn('유효하지 않은 자격증 타입:', type);
    return;
  }
  localStorage.setItem('selectedCertificate', type);
  localStorage.setItem('currentCertificateType', type);
  console.log('자격증 타입 설정:', type);

  document.dispatchEvent(new CustomEvent('certificateTypeChanged', {
    detail: { type }
  }));
}

/**
 * 자격증 타입 이름 반환
 */
export function getCertificateName(type) {
  return CERT_REGISTRY[type]?.name || '알 수 없음';
}

/**
 * 자격증 타입 한글 이름 반환 (getCertificateName과 동일, 호환성 유지)
 */
export function getCertificateNameKo(type) {
  return CERT_REGISTRY[type]?.name || '알 수 없음';
}

/**
 * 자격증 타입 이모지 반환
 */
export function getCertificateEmoji(type) {
  return CERT_REGISTRY[type]?.emoji || '📚';
}

/**
 * 자격증 색상 정보 반환
 */
export function getCertificateColor(type) {
  return CERT_REGISTRY[type]?.color || CERT_REGISTRY['health-manager'].color;
}

/**
 * 폴더 경로 반환
 * 예: getFolder('sports-instructor-1', 'exam') → 'exam-sports1/'
 */
export function getFolder(type, prefix) {
  const suffix = CERT_REGISTRY[type]?.folderSuffix || '';
  return prefix + suffix + '/';
}

/**
 * 호환성 보장: 기존 데이터 포함 쿼리 조건 생성
 */
export function getCertificateQueryConditions(targetType) {
  if (targetType === 'health-manager') {
    return {
      includeNull: true,
      types: ['health-manager']
    };
  }
  return {
    includeNull: false,
    types: [targetType]
  };
}

/**
 * 쿼리 결과 필터링 (클라이언트 측)
 */
export function filterByCertificateType(documents, targetType = 'health-manager') {
  return documents.filter(doc => {
    const docCertType = doc.certificateType || 'health-manager';
    return docCertType === targetType;
  });
}

/**
 * 데이터 정규화: certificateType 필드 추가
 */
export function normalizeCertificateType(data) {
  if (!data.certificateType) {
    return {
      ...data,
      certificateType: 'health-manager'
    };
  }
  return data;
}

/**
 * 문서 배열 정규화
 */
export function normalizeCertificateTypes(documents) {
  return documents.map(normalizeCertificateType);
}

/**
 * 과목 복합 키 생성 (자격증 + 과목)
 */
export function getSubjectKey(certificateType, subject) {
  if (!certificateType || !subject) {
    console.warn('유효하지 않은 입력:', { certificateType, subject });
    return `health-manager_${subject || '알수없음'}`;
  }
  return `${certificateType}_${subject}`;
}

/**
 * 과목 복합 키 파싱
 */
export function parseSubjectKey(subjectKey) {
  if (!subjectKey || !subjectKey.includes('_')) {
    return {
      certificateType: 'health-manager',
      subject: subjectKey || '알수없음'
    };
  }

  const parts = subjectKey.split('_');
  const certificateType = parts[0];
  const subject = parts.slice(1).join('_');

  return { certificateType, subject };
}

/**
 * 표시용 과목명 (자격증 이모지 포함)
 */
export function getDisplaySubjectName(certificateType, subject, includeEmoji = true) {
  if (!includeEmoji) {
    return subject;
  }
  const emoji = getCertificateEmoji(certificateType);
  return `${emoji} ${subject}`;
}

/**
 * 현재 자격증 타입에 해당하는 시도만 필터링
 */
export function filterAttemptsByCertificate(attempts, certificateType) {
  if (!certificateType) {
    certificateType = 'health-manager';
  }

  return attempts.filter(attempt => {
    const attemptCertType = attempt.certificateType ||
      attempt.questionData?.certificateType ||
      'health-manager';
    return attemptCertType === certificateType;
  });
}

/**
 * 과목별 통계 그룹화 (자격증 완전 분리)
 */
export function groupBySubject(attempts, certificateType) {
  const grouped = {};
  const filteredAttempts = filterAttemptsByCertificate(attempts, certificateType);

  filteredAttempts.forEach(attempt => {
    const subject = attempt.subject ||
      attempt.questionData?.subject ||
      '알수없음';

    if (!grouped[subject]) {
      grouped[subject] = {
        certificateType: certificateType,
        subject: subject,
        displayName: getDisplaySubjectName(certificateType, subject),
        attempts: []
      };
    }

    grouped[subject].attempts.push(attempt);
  });

  return grouped;
}

/**
 * 자격증별 통계 계산
 */
export function calculateCertificateStats(attempts, certificateType) {
  const filteredAttempts = filterAttemptsByCertificate(attempts, certificateType);

  const total = filteredAttempts.length;
  const correct = filteredAttempts.filter(a => a.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    certificateType,
    certificateName: getCertificateName(certificateType),
    emoji: getCertificateEmoji(certificateType),
    total,
    correct,
    incorrect: total - correct,
    accuracy
  };
}

// 전역 객체에 노출 (디버깅용)
if (typeof window !== 'undefined') {
  window.certificateUtils = {
    CERT_REGISTRY,
    getAllCertTypes,
    getAllSubjects,
    getCurrentCertificateType,
    setCertificateType,
    getCertificateName,
    getCertificateNameKo,
    getCertificateEmoji,
    getCertificateColor,
    getFolder,
    getCertificateQueryConditions,
    filterByCertificateType,
    normalizeCertificateType,
    normalizeCertificateTypes,
    getSubjectKey,
    parseSubjectKey,
    getDisplaySubjectName,
    filterAttemptsByCertificate,
    groupBySubject,
    calculateCertificateStats
  };

  console.log('✅ Certificate Utils 로드 완료 (CERT_REGISTRY 기반)');
}
