# 데이터베이스 자격증 구분 필드 추가

## 📋 개요
2급 스포츠지도사 자격증 추가로 인해 데이터베이스 스키마에 `certificateType` 필드가 추가되었습니다.

## 🎓 certificateType 필드

### 값
- `'health-manager'` - 건강운동관리사
- `'sports-instructor'` - 2급 스포츠지도사

### 적용 컬렉션
1. **attempts** - 문제 풀이 기록
2. **mockExamResults** - 모의고사 결과
3. **sessions** - 학습 세션 (향후 추가 필요)
4. **userProgress** - 사용자 진도 (향후 추가 필요)

## ✅ 완료된 수정

### 1. js/data/quiz-repository.js

#### recordAttempt 함수 (87번째 줄)
```javascript
const attemptData = {
  userId: user.uid,
  // ... 기존 필드들 ...
  
  // 🎓 자격증 구분 필드 (NEW)
  certificateType: questionData?.certificateType || 'health-manager',
  
  // ... 나머지 필드들 ...
};
```

#### batchRecordAttempts 함수 (198번째 줄)
```javascript
const attemptData = {
  userId: user.uid,
  // ... 기존 필드들 ...
  
  // 🎓 자격증 구분 필드 (NEW)
  certificateType: attempt.questionData?.certificateType || 'health-manager',
  
  // ... 나머지 필드들 ...
};
```

#### recordMockExamResults 함수 (515번째 줄)
```javascript
const mockExamResultData = {
  ...resultData,
  userId: user.uid,
  // ... 기존 필드들 ...
  
  // 🎓 자격증 구분 필드 (NEW)
  certificateType: resultData.certificateType || 'health-manager',
  
  timestamp: serverTimestamp(),
  submittedAt: new Date().toISOString()
};
```

## ⚠️ 추가 수정 필요

### 2. 문제 로드 시 certificateType 추가

#### quiz-core.js 또는 quiz-data-handler.js
문제를 로드할 때 자격증 정보를 포함해야 합니다:

```javascript
// URL이나 페이지 컨텍스트에서 자격증 타입 가져오기
const certificateType = getCurrentCertificateType(); // 구현 필요

// 문제 데이터에 자격증 정보 추가
questionData.certificateType = certificateType;
```

#### 구현 방법
1. **URL 파라미터 사용**
   ```javascript
   const urlParams = new URLSearchParams(window.location.search);
   const certType = urlParams.get('cert') || 'health-manager';
   ```

2. **폴더 경로 기반**
   ```javascript
   function getCertificateTypeFromPath() {
     const path = window.location.pathname;
     if (path.includes('exam-sports/') || 
         path.includes('subjects-sports/') || 
         path.includes('years-sports/')) {
       return 'sports-instructor';
     }
     return 'health-manager';
   }
   ```

3. **localStorage 사용**
   ```javascript
   const certType = localStorage.getItem('selectedCertificate') || 'health-manager';
   ```

### 3. Analytics 쿼리 수정

#### js/analytics/*.js 파일들
모든 쿼리에 자격증 필터를 추가해야 합니다:

```javascript
// 기존 쿼리
const q = query(
  collection(db, 'attempts'),
  where('userId', '==', user.uid),
  orderBy('timestamp', 'desc')
);

// 수정된 쿼리 (자격증 필터 추가)
const q = query(
  collection(db, 'attempts'),
  where('userId', '==', user.uid),
  where('certificateType', '==', certificateType),  // 추가
  orderBy('timestamp', 'desc')
);
```

#### 영향받는 파일들
- `js/analytics/user-analytics.js`
- `js/analytics/analytics-dashboard.js`
- `js/analytics/advanced-analytics.js`
- `js/analytics/scorecard-component.js`
- `js/analytics/analytics-question-sets.js`

### 4. Session Manager 수정

#### js/data/session-manager.js
세션 시작 시 자격증 정보를 저장:

```javascript
async startNewSession(metadata = {}) {
  const sessionData = {
    userId: user.uid,
    // ... 기존 필드들 ...
    
    // 🎓 자격증 구분 필드 추가
    certificateType: metadata.certificateType || 'health-manager',
    
    startTime: serverTimestamp(),
    // ... 나머지 필드들 ...
  };
  
  // ...
}
```

### 5. Firebase Security Rules 업데이트

#### firestore.rules
인덱스 및 보안 규칙 추가:

```javascript
match /attempts/{attemptId} {
  allow read: if request.auth != null && 
                 request.auth.uid == resource.data.userId;
  
  allow write: if request.auth != null && 
                  request.auth.uid == request.resource.data.userId &&
                  // certificateType 검증
                  request.resource.data.certificateType in ['health-manager', 'sports-instructor'];
}

match /mockExamResults/{resultId} {
  allow read: if request.auth != null && 
                 request.auth.uid == resource.data.userId;
  
  allow write: if request.auth != null && 
                  request.auth.uid == request.resource.data.userId &&
                  // certificateType 검증
                  request.resource.data.certificateType in ['health-manager', 'sports-instructor'];
}
```

### 6. Firestore 인덱스 생성

Firebase Console에서 다음 인덱스를 생성해야 합니다:

#### attempts 컬렉션
```
Collection: attempts
Fields:
  - userId (Ascending)
  - certificateType (Ascending)
  - timestamp (Descending)
```

#### mockExamResults 컬렉션
```
Collection: mockExamResults
Fields:
  - userId (Ascending)
  - certificateType (Ascending)
  - timestamp (Descending)
```

## 🔧 추천 구현 순서

### 단계 1: certificateType 감지 함수 추가 (높은 우선순위)
`js/utils/certificate-utils.js` 파일 생성:
```javascript
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
  
  // 2. 경로 기반 감지
  const path = window.location.pathname;
  if (path.includes('exam-sports/') || 
      path.includes('subjects-sports/') || 
      path.includes('years-sports/')) {
    localStorage.setItem('selectedCertificate', 'sports-instructor');
    return 'sports-instructor';
  }
  
  // 3. localStorage 확인
  const stored = localStorage.getItem('selectedCertificate');
  if (stored) return stored;
  
  // 4. 기본값
  return 'health-manager';
}

/**
 * 자격증 타입 설정
 * @param {'health-manager' | 'sports-instructor'} type
 */
export function setCertificateType(type) {
  localStorage.setItem('selectedCertificate', type);
}

/**
 * 자격증 타입 한글 이름 반환
 * @param {string} type
 * @returns {string}
 */
export function getCertificateName(type) {
  const names = {
    'health-manager': '건강운동관리사',
    'sports-instructor': '2급 스포츠지도사'
  };
  return names[type] || '알 수 없음';
}
```

### 단계 2: quiz-core.js 수정
문제 로드 시 certificateType 추가:
```javascript
import { getCurrentCertificateType } from '../utils/certificate-utils.js';

// 문제 데이터 로드 후
questions.forEach(q => {
  q.certificateType = getCurrentCertificateType();
});
```

### 단계 3: index.html 자격증 선택 버튼에 이벤트 추가
```javascript
import { setCertificateType } from './js/utils/certificate-utils.js';

document.querySelectorAll('.cert-button').forEach(button => {
  button.addEventListener('click', () => {
    const certType = button.getAttribute('data-cert');
    setCertificateType(certType);  // localStorage에 저장
    
    // ... 나머지 전환 로직 ...
  });
});
```

### 단계 4: Analytics 페이지 수정
자격증 필터 UI 추가 및 쿼리 수정

### 단계 5: Firebase 설정 업데이트
Security Rules 및 인덱스 적용

## 📊 데이터 마이그레이션

### 기존 데이터 처리
기존 데이터는 `certificateType`이 없으므로 쿼리 시 기본값 처리:

```javascript
// 쿼리 시
const certType = doc.data().certificateType || 'health-manager';

// 또는 쿼리 자체에서
where('certificateType', 'in', ['health-manager', null])
```

### 선택적 마이그레이션 스크립트
기존 데이터에 `certificateType: 'health-manager'` 추가하는 스크립트 (선택사항)

## 🎯 핵심 포인트

1. **모든 문제 풀이 기록에 certificateType 추가됨**
2. **자격증별로 학습 데이터 분리 가능**
3. **Analytics에서 자격증 필터링 가능**
4. **기존 데이터는 자동으로 'health-manager'로 처리**

## 📞 문제 발생 시
- certificateType이 없는 데이터는 자동으로 'health-manager'로 간주
- 쿼리 오류 발생 시 Firestore 인덱스 확인
- Security Rules 오류 시 Firebase Console에서 규칙 업데이트

