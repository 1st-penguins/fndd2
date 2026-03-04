# 과목 중복 문제 해결 방안

## 🚨 문제 상황

건강운동관리사와 2급 생활스포츠지도사에 **같은 이름의 과목**이 존재:

### 중복 과목
- **운동생리학** (건강운동관리사 과목코드 70, 생활스포츠지도사 과목코드 04)
- **스포츠심리학** (건강운동관리사 과목코드 77, 생활스포츠지도사 과목코드 03)

### 왜 문제인가?
1. **통계 혼합**: subject만으로 그룹핑하면 두 자격증 데이터가 섞임
2. **잘못된 분석**: 약점 분석 시 서로 다른 자격증 문제가 합쳐짐
3. **추천 오류**: 건강운동관리사 문제를 푸는데 생활스포츠지도사 문제 추천

## ✅ 해결 방안

### 방안 1: Composite Key 사용 (권장)

#### 개념
내부적으로 `certificateType + subject` 조합 키 사용:
- `health-manager_운동생리학`
- `sports-instructor_운동생리학`

#### 구현
```javascript
/**
 * 과목 복합 키 생성
 * @param {string} certificateType
 * @param {string} subject
 * @returns {string} 복합 키
 */
export function getSubjectKey(certificateType, subject) {
  return `${certificateType}_${subject}`;
}

/**
 * 과목 복합 키 파싱
 * @param {string} subjectKey
 * @returns {Object} { certificateType, subject }
 */
export function parseSubjectKey(subjectKey) {
  const [certificateType, ...subjectParts] = subjectKey.split('_');
  return {
    certificateType,
    subject: subjectParts.join('_')
  };
}

/**
 * 표시용 과목명 (자격증 이모지 포함)
 * @param {string} certificateType
 * @param {string} subject
 * @returns {string}
 */
export function getDisplaySubjectName(certificateType, subject) {
  const emoji = certificateType === 'health-manager' ? '🏋️' : '⚽';
  return `${emoji} ${subject}`;
}
```

### 방안 2: 항상 certificateType 필터 포함

#### 쿼리 수정
```javascript
// ❌ 잘못된 방법 (과목만 필터)
const subjectAttempts = allAttempts.filter(a => a.subject === '운동생리학');

// ✅ 올바른 방법 (자격증 + 과목)
const subjectAttempts = allAttempts.filter(a => 
  a.certificateType === currentCertType && 
  (a.subject || a.questionData?.subject) === '운동생리학'
);
```

#### 통계 집계
```javascript
// ❌ 잘못된 방법
const subjectStats = {};
attempts.forEach(attempt => {
  const subject = attempt.subject;
  if (!subjectStats[subject]) {
    subjectStats[subject] = { total: 0, correct: 0 };
  }
  subjectStats[subject].total++;
  // ...
});

// ✅ 올바른 방법
const subjectStats = {};
attempts.forEach(attempt => {
  const certType = attempt.certificateType || 'health-manager';
  const subject = attempt.subject || attempt.questionData?.subject;
  const key = `${certType}_${subject}`;  // 복합 키
  
  if (!subjectStats[key]) {
    subjectStats[key] = { 
      certificateType: certType,
      subject: subject,
      total: 0, 
      correct: 0 
    };
  }
  subjectStats[key].total++;
  // ...
});
```

### 방안 3: UI 표시 개선

#### 과목명에 자격증 구분 표시
```javascript
// 학습 분석 화면
const displayName = certificateType === 'health-manager' 
  ? `🏋️ ${subject}` 
  : `⚽ ${subject}`;

// 또는 뱃지 추가
<div class="subject-badge">
  <span class="cert-icon">{emoji}</span>
  <span class="subject-name">{subject}</span>
</div>
```

## 🔧 필수 수정 파일

### 1. js/utils/certificate-utils.js (추가)
```javascript
/**
 * 과목 복합 키 생성 (자격증 + 과목)
 * @param {string} certificateType
 * @param {string} subject
 * @returns {string}
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
 * 표시용 과목명 (자격증 이모지 포함)
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
 * 현재 자격증 타입에 해당하는 시도만 필터링
 * @param {Array} attempts
 * @param {string} certificateType
 * @returns {Array}
 */
export function filterAttemptsByCertificate(attempts, certificateType) {
  return attempts.filter(attempt => {
    const attemptCertType = attempt.certificateType || 
                           attempt.questionData?.certificateType || 
                           'health-manager';
    return attemptCertType === certificateType;
  });
}

/**
 * 과목별 통계 그룹화 (자격증 구분)
 * @param {Array} attempts
 * @returns {Object} 과목별 통계 (key: certificateType_subject)
 */
export function groupBySubject(attempts) {
  const grouped = {};
  
  attempts.forEach(attempt => {
    const certType = attempt.certificateType || 
                    attempt.questionData?.certificateType || 
                    'health-manager';
    const subject = attempt.subject || 
                   attempt.questionData?.subject || 
                   '알수없음';
    
    const key = getSubjectKey(certType, subject);
    
    if (!grouped[key]) {
      grouped[key] = {
        certificateType: certType,
        subject: subject,
        displayName: getDisplaySubjectName(certType, subject),
        attempts: []
      };
    }
    
    grouped[key].attempts.push(attempt);
  });
  
  return grouped;
}
```

### 2. js/analytics/user-analytics.js 수정
```javascript
import { getSubjectKey, parseSubjectKey, getDisplaySubjectName, groupBySubject } from '../utils/certificate-utils.js';

/**
 * 사용자의 약점 분석 (수정 - 자격증 구분)
 */
export function analyzeWeaknesses(attempts, certificateType) {
  // 현재 자격증 타입의 시도만 필터링
  const filteredAttempts = attempts.filter(attempt => {
    const attemptCertType = attempt.certificateType || 'health-manager';
    return attemptCertType === certificateType;
  });
  
  // 과목별 통계 초기화 (복합 키 사용)
  const subjectStats = {};
  
  // 시도 데이터 집계
  filteredAttempts.forEach(attempt => {
    const subject = attempt.questionData?.subject || attempt.subject;
    if (subject) {
      // 복합 키 생성
      const key = getSubjectKey(certificateType, subject);
      
      if (!subjectStats[key]) {
        subjectStats[key] = { 
          certificateType,
          subject,
          displayName: getDisplaySubjectName(certificateType, subject),
          total: 0, 
          incorrect: 0 
        };
      }
      
      subjectStats[key].total++;
      if (!attempt.isCorrect) {
        subjectStats[key].incorrect++;
      }
    }
  });
  
  // 오답률 계산
  const weaknessData = Object.values(subjectStats)
    .filter(stat => stat.total >= 5)
    .map(stat => ({
      ...stat,
      incorrectRate: Math.round((stat.incorrect / stat.total) * 100),
      color: getWeaknessColor(Math.round((stat.incorrect / stat.total) * 100))
    }))
    .sort((a, b) => b.incorrectRate - a.incorrectRate);
  
  return weaknessData;
}
```

### 3. js/analytics/analytics-loader.js 수정
```javascript
import { getCurrentCertificateType } from '../utils/certificate-utils.js';

/**
 * 학습 분석 데이터 로드 (자격증 필터 추가)
 */
async function loadAnalyticsData() {
  // 현재 선택된 자격증 타입 가져오기
  const currentCertType = getCurrentCertificateType();
  
  console.log(`[analytics-loader] ${currentCertType} 데이터 로드 중...`);
  
  // 데이터 로드 시 자격증 타입 전달
  const attempts = await getUserAttempts(100, currentCertType);
  const mockExamResults = await getUserMockExamResults(20, currentCertType);
  
  // ... 나머지 로직
}
```

### 4. 학습 분석 UI 업데이트
```javascript
// 자격증 필터 UI 추가
function renderCertificateFilter() {
  const currentCert = getCurrentCertificateType();
  
  const filterHtml = `
    <div class="cert-filter">
      <button class="cert-filter-btn ${currentCert === 'health-manager' ? 'active' : ''}"
              data-cert="health-manager">
        🏋️ 건강운동관리사
      </button>
      <button class="cert-filter-btn ${currentCert === 'sports-instructor' ? 'active' : ''}"
              data-cert="sports-instructor">
        ⚽ 2급 생활스포츠지도사
      </button>
    </div>
  `;
  
  // 필터 버튼 이벤트
  document.querySelectorAll('.cert-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newCert = btn.dataset.cert;
      setCertificateType(newCert);
      loadAnalyticsData();  // 데이터 재로드
    });
  });
}
```

## 📊 데이터 예시

### 기존 방식 (문제 있음)
```javascript
{
  "운동생리학": {
    total: 50,      // 건강운동관리사 30 + 생활스포츠지도사 20 (섞임!)
    correct: 30
  }
}
```

### 새 방식 (올바름)
```javascript
{
  "health-manager_운동생리학": {
    certificateType: "health-manager",
    subject: "운동생리학",
    displayName: "🏋️ 운동생리학",
    total: 30,
    correct: 20
  },
  "sports-instructor_운동생리학": {
    certificateType: "sports-instructor",
    subject: "운동생리학",
    displayName: "⚽ 운동생리학",
    total: 20,
    correct: 15
  }
}
```

## 🎯 핵심 원칙

### 항상 지켜야 할 규칙
1. **쿼리 시**: certificateType 필터 필수
2. **집계 시**: certificateType + subject 복합 키 사용
3. **표시 시**: 사용자에게 명확하게 구분 (이모지 또는 뱃지)
4. **저장 시**: certificateType 필드 반드시 포함

### 체크리스트
- [ ] 모든 쿼리 함수에 certificateType 파라미터 추가
- [ ] 통계 집계 로직 복합 키 사용
- [ ] UI에 자격증 필터 추가
- [ ] 약점 분석 함수 수정
- [ ] 추천 문제 생성 로직 수정
- [ ] 학습 분석 대시보드 업데이트

## 🔍 테스트 시나리오

### 시나리오 1: 같은 과목, 다른 자격증
1. 건강운동관리사 운동생리학 10문제 풀기 (정답률 80%)
2. 생활스포츠지도사 운동생리학 10문제 풀기 (정답률 60%)
3. 학습 분석에서 각각 구분되어 표시되는지 확인
4. 약점 분석에서 올바른 추천이 나오는지 확인

### 시나리오 2: 자격증 전환
1. 건강운동관리사 선택 → 데이터 확인
2. 생활스포츠지도사로 전환 → 데이터 다시 로드
3. 통계가 올바르게 구분되는지 확인

## 💡 추가 개선 사항

### 과목 코드 활용
더 명확한 구분을 위해 과목 코드도 저장:
```javascript
{
  certificateType: "health-manager",
  subject: "운동생리학",
  subjectCode: "70",  // 과목 코드 추가
  // ...
}
```

### DB 인덱스 최적화
Firestore 복합 인덱스:
```
Collection: attempts
Fields:
  - userId (Ascending)
  - certificateType (Ascending)
  - subject (Ascending)
  - timestamp (Descending)
```

