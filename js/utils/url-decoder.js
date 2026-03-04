// url-decoder.js - URL 디코딩 유틸리티

/**
 * 안전한 URL 디코딩
 * @param {string} str - 디코딩할 문자열
 * @returns {string} 디코딩된 문자열
 */
export function safeDecodeURIComponent(str) {
  if (!str) return str;
  
  try {
    // 이미 디코딩된 문자열인지 확인
    if (str === decodeURIComponent(str)) {
      return str;
    }
    
    // 디코딩 시도
    return decodeURIComponent(str);
  } catch (error) {
    console.warn('URL 디코딩 오류:', error, 'Original:', str);
    
    // 디코딩 실패 시 원본 반환
    return str;
  }
}

/**
 * URL에서 과목명 추출 (안전한 디코딩 포함)
 * @param {string} url - URL 또는 파일명
 * @returns {string} 과목명
 */
export function extractSubjectFromURL(url = window.location.pathname) {
  try {
    const pathSegments = url.split('/');
    const filename = pathSegments[pathSegments.length - 1];
    
    // 패턴: 2024_운동생리학.html
    const filenameMatch = filename.match(/(\d{4})_([^.]+)/);
    
    if (filenameMatch && filenameMatch[2]) {
      let subject = filenameMatch[2];
      
      // ✅ URL 디코딩
      subject = safeDecodeURIComponent(subject);
      
      // 모의고사 패턴 처리
      if (subject.includes('모의고사')) {
        return subject; // "모의고사_1교시" 형태
      }
      
      return subject;
    }
    
    return '운동생리학'; // 기본값
  } catch (error) {
    console.error('과목명 추출 오류:', error);
    return '운동생리학';
  }
}

/**
 * URL에서 연도 추출
 * @param {string} url - URL 또는 파일명
 * @returns {string} 연도
 */
export function extractYearFromURL(url = window.location.pathname) {
  try {
    const pathSegments = url.split('/');
    const filename = pathSegments[pathSegments.length - 1];
    
    // 패턴: 2024_운동생리학.html
    const filenameMatch = filename.match(/(\d{4})_/);
    
    if (filenameMatch && filenameMatch[1]) {
      return filenameMatch[1];
    }
    
    // URL 전체에서 연도 추출 시도
    const yearMatch = url.match(/20\d{2}/);
    if (yearMatch) {
      return yearMatch[0];
    }
    
    return new Date().getFullYear().toString();
  } catch (error) {
    console.error('연도 추출 오류:', error);
    return new Date().getFullYear().toString();
  }
}

/**
 * 과목명이 URL 인코딩되어 있는지 확인
 * @param {string} subject - 과목명
 * @returns {boolean} URL 인코딩 여부
 */
export function isURLEncoded(subject) {
  if (!subject) return false;
  
  // % 문자가 있으면 인코딩된 것
  return subject.includes('%');
}

/**
 * 잘못된 과목명 수정
 * @param {string} subject - 과목명
 * @returns {string} 수정된 과목명
 */
export function fixSubjectName(subject) {
  if (!subject) return '과목없음';
  
  // URL 인코딩된 경우 디코딩
  if (isURLEncoded(subject)) {
    subject = safeDecodeURIComponent(subject);
  }
  
  // 알려진 과목명 목록
  const validSubjects = [
    '운동생리학',
    '건강체력평가',
    '운동처방론',
    '운동부하검사',
    '운동상해',
    '기능해부학',
    '병태생리학',
    '스포츠심리학'
  ];
  
  // 정확한 매칭 확인
  if (validSubjects.includes(subject)) {
    return subject;
  }
  
  // 부분 매칭 시도
  for (const validSubject of validSubjects) {
    if (subject.includes(validSubject) || validSubject.includes(subject)) {
      return validSubject;
    }
  }
  
  console.warn('알 수 없는 과목명:', subject);
  return subject;
}

export default {
  safeDecodeURIComponent,
  extractSubjectFromURL,
  extractYearFromURL,
  isURLEncoded,
  fixSubjectName
};

