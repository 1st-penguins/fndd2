// certificate-utils.js - 자격증 관련 유틸리티 함수

/**
 * 현재 페이지의 자격증 타입 감지
 * @returns {'health-manager' | 'sports-instructor'}
 */
export function getCurrentCertificateType() {
  // 1. URL 파라미터 확인
  const urlParams = new URLSearchParams(window.location.search);
  const urlCert = urlParams.get('cert');
  if (urlCert) {
    localStorage.setItem('selectedCertificate', urlCert);
    return urlCert;
  }

  // 2. 경로 기반 감지 (sports 관련 폴더)
  const path = window.location.pathname;
  if (path.includes('exam-sports/') ||
    path.includes('subjects-sports/') ||
    path.includes('years-sports/') ||
    path.includes('data-sports/') ||
    path.includes('images-sports/')) {
    localStorage.setItem('selectedCertificate', 'sports-instructor');
    return 'sports-instructor';
  }

  // 3. localStorage 확인 (currentCertificateType 우선, 없으면 selectedCertificate)
  const currentStored = localStorage.getItem('currentCertificateType');
  if (currentStored) {
    return currentStored;
  }

  const stored = localStorage.getItem('selectedCertificate');
  if (stored) {
    return stored;
  }

  // 4. 기본값 (건강운동관리사)
  return 'health-manager';
}

/**
 * 자격증 타입 설정
 * @param {'health-manager' | 'sports-instructor'} type
 */
export function setCertificateType(type) {
  if (type !== 'health-manager' && type !== 'sports-instructor') {
    console.warn('유효하지 않은 자격증 타입:', type);
    return;
  }
  localStorage.setItem('selectedCertificate', type);
  localStorage.setItem('currentCertificateType', type); // 🎯 통일된 키 사용
  console.log('자격증 타입 설정:', type);

  // 🎯 이벤트 디스패치 (헤더 배지 업데이트용)
  document.dispatchEvent(new CustomEvent('certificateTypeChanged', {
    detail: { type }
  }));
}

/**
 * 자격증 타입 이름 반환
 * @param {string} type
 * @returns {string}
 */
export function getCertificateName(type) {
  const names = {
    'health-manager': '건강운동관리사',
    'sports-instructor': '2급 생활스포츠지도사'
  };
  return names[type] || '알 수 없음';
}

/**
 * 자격증 타입 한글 이름 반환
 * @param {string} type
 * @returns {string}
 */
export function getCertificateNameKo(type) {
  const names = {
    'health-manager': '건강운동관리사',
    'sports-instructor': '2급 생활스포츠지도사'
  };
  return names[type] || '알 수 없음';
}

/**
 * 자격증 타입 이모지 반환
 * @param {string} type
 * @returns {string}
 */
export function getCertificateEmoji(type) {
  const emojis = {
    'health-manager': '🏋️',
    'sports-instructor': '⚽'
  };
  return emojis[type] || '📚';
}

/**
 * 🔧 호환성 보장: 기존 데이터 포함 쿼리 조건 생성
 * 
 * certificateType 필드가 없는 기존 데이터는 자동으로 'health-manager'로 간주
 * 
 * @param {string} targetType - 조회할 자격증 타입
 * @returns {Array} Firestore 쿼리 조건 배열
 */
export function getCertificateQueryConditions(targetType) {
  if (targetType === 'health-manager') {
    // 건강운동관리사: certificateType이 없거나 'health-manager'인 경우 모두 포함
    // ⚠️ Firestore는 OR 조건을 직접 지원하지 않으므로 클라이언트 필터링 사용
    return {
      includeNull: true,  // null 값 포함
      types: ['health-manager']
    };
  } else if (targetType === 'sports-instructor') {
    // 2급 생활스포츠지도사: certificateType이 명시적으로 'sports-instructor'인 경우만
    return {
      includeNull: false,
      types: ['sports-instructor']
    };
  }

  return {
    includeNull: true,
    types: ['health-manager']
  };
}

/**
 * 🔧 쿼리 결과 필터링 (클라이언트 측)
 * 
 * Firestore에서 가져온 데이터를 자격증 타입으로 필터링
 * certificateType이 없는 데이터는 'health-manager'로 간주
 * 
 * @param {Array} documents - Firestore 문서 배열
 * @param {string} targetType - 필터링할 자격증 타입
 * @returns {Array} 필터링된 문서 배열
 */
export function filterByCertificateType(documents, targetType = 'health-manager') {
  return documents.filter(doc => {
    const docCertType = doc.certificateType || 'health-manager';  // 기본값 처리
    return docCertType === targetType;
  });
}

/**
 * 🔧 데이터 정규화: certificateType 필드 추가
 * 
 * certificateType이 없는 데이터에 기본값 추가
 * 
 * @param {Object} data - 원본 데이터
 * @returns {Object} certificateType이 추가된 데이터
 */
export function normalizeCertificateType(data) {
  if (!data.certificateType) {
    return {
      ...data,
      certificateType: 'health-manager'  // 기존 데이터는 건강운동관리사로 간주
    };
  }
  return data;
}

/**
 * 문서 배열 정규화
 * @param {Array} documents
 * @returns {Array}
 */
export function normalizeCertificateTypes(documents) {
  return documents.map(normalizeCertificateType);
}

/**
 * 🎯 과목 복합 키 생성 (자격증 + 과목)
 * 건강운동관리사와 생활스포츠지도사의 같은 이름 과목을 완전히 분리
 * 
 * @param {string} certificateType
 * @param {string} subject
 * @returns {string} 복합 키 (예: 'health-manager_운동생리학')
 */
export function getSubjectKey(certificateType, subject) {
  if (!certificateType || !subject) {
    console.warn('유효하지 않은 입력:', { certificateType, subject });
    return `health-manager_${subject || '알수없음'}`;
  }
  return `${certificateType}_${subject}`;
}

/**
 * 🎯 과목 복합 키 파싱
 * 
 * @param {string} subjectKey - 예: 'health-manager_운동생리학'
 * @returns {Object} { certificateType, subject }
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
 * 🎯 표시용 과목명 (자격증 이모지 포함)
 * 
 * @param {string} certificateType
 * @param {string} subject
 * @param {boolean} includeEmoji - 이모지 포함 여부
 * @returns {string}
 */
export function getDisplaySubjectName(certificateType, subject, includeEmoji = true) {
  if (!includeEmoji) {
    return subject;
  }

  const emoji = getCertificateEmoji(certificateType);
  return `${emoji} ${subject}`;
}

/**
 * 🎯 현재 자격증 타입에 해당하는 시도만 필터링
 * 
 * @param {Array} attempts
 * @param {string} certificateType
 * @returns {Array}
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
 * 🎯 과목별 통계 그룹화 (자격증 완전 분리)
 * 
 * @param {Array} attempts
 * @param {string} certificateType - 특정 자격증만 집계 (필수)
 * @returns {Object} 과목별 통계 (key: subject, 자격증 구분됨)
 */
export function groupBySubject(attempts, certificateType) {
  const grouped = {};

  // 먼저 자격증으로 필터링
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
 * 🎯 자격증별 통계 계산
 * 
 * @param {Array} attempts
 * @param {string} certificateType
 * @returns {Object} 통계 정보
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
    getCurrentCertificateType,
    setCertificateType,
    getCertificateName,
    getCertificateNameKo,  // 추가
    getCertificateEmoji,
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

  console.log('✅ Certificate Utils 로드 완료 (완전 분리 모드)');
}

