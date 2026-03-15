# 🎯 자격증 완전 분리 구현 완료

## 개요

**Exercise Specialist (건강운동관리사)**와 **2급 스포츠지도사** 두 자격증을 **완전히 분리**하여 운영합니다.
- 데이터 저장/조회 시 자격증 구분 (Firestore)
- 통계/분석 시 자격증 완전 분리
- 같은 이름의 과목도 자격증별로 독립 처리

---

## 📁 폴더 구조

### Exercise Specialist (건강운동관리사) - 기존
```
- exam/          # 문제 HTML 파일
- subjects/      # 과목별 페이지
- years/         # 연도별 페이지
- data/          # JSON 데이터
- images/        # 이미지 파일
```

### 2급 스포츠지도사 (신규)
```
- exam-sports/       # 문제 HTML 파일
- subjects-sports/   # 과목별 페이지
- years-sports/      # 연도별 페이지
- data-sports/       # JSON 데이터
- images-sports/     # 이미지 파일
```

---

## 🎯 핵심 메커니즘

### 1. 자격증 타입 관리 (`js/utils/certificate-utils.js`)

```javascript
// 현재 선택된 자격증 가져오기
getCurrentCertificateType()  // 'health-manager' 또는 'sports-instructor'

// 자격증 변경
setCertificateType('sports-instructor')

// 자격증 이름 표시
getCertificateName('health-manager')  // "Exercise Specialist"
getCertificateNameKo('health-manager')  // "건강운동관리사" (한글)
getCertificateEmoji('sports-instructor')  // "⚽"
```

### 2. 데이터 저장 시 자격증 정보 포함

**Firestore 저장 예시:**
```javascript
{
  userId: "...",
  year: "2025",
  subject: "운동생리학",
  certificateType: "health-manager",  // 🎯 필수 필드
  userAnswer: 2,
  isCorrect: true,
  timestamp: ...
}
```

**구현 위치:**
- `js/data/quiz-repository.js`: `recordAttempt()`, `recordMockExamResults()`
- `js/quiz/quiz-core.js`: `questionData` 생성 시 자동으로 `certificateType` 추가

### 3. 데이터 조회 시 자격증 필터링

**클라이언트 필터링 방식 (기존 데이터 호환):**
```javascript
// 기존 데이터는 certificateType 필드가 없음 → 'health-manager'로 간주
const filteredAttempts = filterAttemptsByCertificate(attempts, 'health-manager');
```

**구현 위치:**
- `js/data/quiz-data-service.js`: `getUserAttempts()`, `getUserMockExamResults()`
- `js/utils/certificate-utils.js`: `filterAttemptsByCertificate()`

### 4. 통계/분석 완전 분리

**약점 분석 예시:**
```javascript
// 건강운동관리사의 약점만 분석
const weaknesses = analyzeWeaknesses(attempts, 'health-manager');

// 결과:
// [
//   { certificateType: 'health-manager', subject: '운동생리학', incorrectRate: 65 },
//   { certificateType: 'health-manager', subject: '건강체력평가', incorrectRate: 58 },
//   ...
// ]
```

**구현 위치:**
- `js/analytics/user-analytics.js`: `analyzeWeaknesses()`, `analyzeRecentActivity()`, `generateRecommendations()`
- `js/analytics/analytics-loader.js`: `renderOverviewStats()`, `renderWeakAreasTab()` 등

---

## 🔄 자격증 전환 흐름

### 사용자가 자격증 버튼 클릭 시

1. **index.html** (자격증 선택 버튼)
   ```javascript
   button.addEventListener('click', () => {
     const targetCert = button.getAttribute('data-cert');
     
     // 🎯 전역 설정
     setCertificateType(targetCert);
     
     // 🎯 localStorage 저장 (새로고침 후에도 유지)
     localStorage.setItem('currentCertificateType', targetCert);
     
     // UI 전환
     // ...
   });
   ```

2. **certificate-utils.js** (전역 상태 업데이트)
   ```javascript
   export function setCertificateType(type) {
     currentCertificateType = type;
     
     // 🎯 다른 페이지/컴포넌트에 알림
     document.dispatchEvent(new CustomEvent('certificateTypeChanged', { 
       detail: { type } 
     }));
   }
   ```

3. **Analytics 페이지** (이벤트 리스너)
   ```javascript
   document.addEventListener('certificateTypeChanged', (e) => {
     const newCertType = e.detail.type;
     console.log(`🎯 자격증 변경 감지: ${newCertType}`);
     
     // 데이터 다시 로드 & 차트 재렌더링
     loadData();
   });
   ```

---

## 🔧 핵심 함수 리스트

### 자격증 관리
- `getCurrentCertificateType()`: 현재 자격증
- `setCertificateType(type)`: 자격증 설정
- `getCertificateName(type)`: 자격증 이름
- `getCertificateEmoji(type)`: 자격증 이모지

### 데이터 필터링
- `filterAttemptsByCertificate(attempts, type)`: 시도 데이터 필터링
- `groupBySubject(attempts, type)`: 과목별 그룹화 (자격증 포함)
- `calculateCertificateStats(attempts, type)`: 자격증별 통계

### 과목 식별
- `getSubjectKey(certType, subject)`: `'health-manager_운동생리학'` 같은 고유 키 생성
- `parseSubjectKey(key)`: 키 → `{ certificateType, subject }`
- `getDisplaySubjectName(certType, subject)`: `'🏋️ 운동생리학'` 표시용 이름

---

## 📊 주요 변경 파일

### 1. 유틸리티 & 데이터
| 파일 | 역할 | 변경 사항 |
|------|------|-----------|
| `js/utils/certificate-utils.js` | 자격증 관리 | ✅ 신규 생성 |
| `js/data/quiz-repository.js` | Firestore 저장 | ✅ `certificateType` 필드 추가 |
| `js/data/quiz-data-service.js` | Firestore 조회 | ✅ 클라이언트 필터링 추가 |

### 2. 퀴즈 & 문제
| 파일 | 역할 | 변경 사항 |
|------|------|-----------|
| `js/quiz/quiz-core.js` | 문제 풀이 | ✅ `questionData`에 `certificateType` 추가 |
| `js/quiz/mock-exam.js` | 모의고사 | ✅ URL 기반 자격증 추론 |

### 3. 분석 & 통계
| 파일 | 역할 | 변경 사항 |
|------|------|-----------|
| `js/analytics/user-analytics.js` | 분석 함수 | ✅ `certificateType` 파라미터 추가 |
| `js/analytics/analytics-loader.js` | UI 렌더링 | ✅ 자격증별 필터링 적용 |

### 4. UI 페이지
| 파일 | 역할 | 변경 사항 |
|------|------|-----------|
| `index.html` | 메인 페이지 | ✅ 자격증 선택 버튼 + 이벤트 |
| `analytics.html` | 학습 분석 | 🔜 이벤트 리스너 추가 예정 |

---

## 🚀 사용 시나리오

### 시나리오 1: Exercise Specialist 문제 풀이
1. 사용자가 index.html에서 **"🏋️ Exercise Specialist"** 버튼 클릭
2. `setCertificateType('health-manager')` 호출
3. `exam/2024_운동생리학.html` 접속
4. 퀴즈 제출 시 `certificateType: 'health-manager'` 포함하여 저장

### 시나리오 2: 생활스포츠지도사 문제 풀이
1. 사용자가 index.html에서 **"⚽ 2급 스포츠지도사"** 버튼 클릭
2. `setCertificateType('sports-instructor')` 호출
3. `exam-sports/2024_스포츠사회학.html` 접속
4. 퀴즈 제출 시 `certificateType: 'sports-instructor'` 포함하여 저장

### 시나리오 3: 학습 분석 확인
1. 사용자가 analytics.html 접속
2. `getCurrentCertificateType()` → 'health-manager' (마지막 선택)
3. Firestore에서 `certificateType: 'health-manager'` 데이터만 조회
4. **Exercise Specialist 전용 통계** 표시
5. "⚽ 2급 스포츠지도사" 버튼 클릭 → 즉시 재로드 및 필터링

---

## ✅ 기존 데이터 호환성

### 문제 상황
- 기존 Firestore 문서는 `certificateType` 필드가 없음
- 쿼리 시 `where('certificateType', '==', 'health-manager')`로 직접 필터링하면 기존 데이터가 제외됨

### 해결 방법
```javascript
// ❌ 직접 Firestore 쿼리 (기존 데이터 제외됨)
query(collection(db, 'attempts'), where('certificateType', '==', 'health-manager'))

// ✅ 클라이언트 필터링 (기존 데이터 포함)
const allAttempts = await getUserAttempts();  // 모든 데이터 가져오기
const filtered = allAttempts.filter(a => {
  const certType = a.certificateType || 'health-manager';  // 기본값 적용
  return certType === 'health-manager';
});
```

**장점:**
- 기존 데이터는 자동으로 '건강운동관리사'로 간주
- 데이터 마이그레이션 불필요
- 신규 데이터부터 `certificateType` 필드 포함

**단점:**
- Firestore 인덱싱 불가 (성능 저하 가능)
- 향후 데이터가 많아지면 마이그레이션 권장

---

## 🛠 향후 확장

### 새 자격증 추가 시

1. **폴더 생성**
   ```
   exam-[새자격증명]/
   subjects-[새자격증명]/
   years-[새자격증명]/
   data-[새자격증명]/
   images-[새자격증명]/
   ```

2. **`certificate-utils.js` 업데이트**
   ```javascript
   const CERTIFICATE_TYPES = {
     'health-manager': { name: '건강운동관리사', emoji: '🏋️' },
     'sports-instructor': { name: '2급 스포츠지도사', emoji: '⚽' },
     'new-cert': { name: '새 자격증', emoji: '🎓' }  // 추가
   };
   ```

3. **index.html 버튼 추가**
   ```html
   <button class="cert-button" data-cert="new-cert">
     🎓 새 자격증
   </button>
   ```

4. **자격증별 콘텐츠 추가**
   ```html
   <div class="cert-content" data-cert-content="new-cert">
     <!-- 과목별/연도별/모의고사 콘텐츠 -->
   </div>
   ```

---

## 📌 중요 체크리스트

### 개발 시 확인사항
- [ ] 새 문제 추가 시 올바른 폴더(`exam` vs `exam-sports`)에 배치
- [ ] JSON 데이터는 올바른 `data/` 또는 `data-sports/` 폴더에 저장
- [ ] 이미지는 올바른 `images/` 또는 `images-sports/` 폴더에 저장
- [ ] HTML 파일에서 상대 경로 올바른지 확인 (`../data-sports/...`)
- [ ] 자격증 간 과목명 중복 시 데이터 혼동 없는지 확인

### 테스트 시나리오
1. **건강운동관리사 선택 → 문제 풀이 → 학습 분석 → 생활스포츠지도사 선택 → 문제 풀이 → 학습 분석**
   - 각 자격증의 통계가 완전히 분리되어 표시되는지 확인
   
2. **같은 이름 과목 테스트 (예: 운동생리학)**
   - 건강운동관리사 운동생리학 vs 생활스포츠지도사 운동생리학
   - 통계/약점 분석에서 혼동 없는지 확인

3. **localStorage 초기화 후 테스트**
   - 기본 자격증 'health-manager'로 설정되는지 확인
   - 자격증 전환 후 새로고침 시 유지되는지 확인

---

## 🎉 완료 상태

✅ **완료된 항목**
- 자격증 관리 유틸리티 (`certificate-utils.js`)
- 데이터 저장 시 `certificateType` 추가 (`quiz-repository.js`, `quiz-core.js`)
- 데이터 조회 시 필터링 (`quiz-data-service.js`)
- 분석 함수 자격증 파라미터 추가 (`user-analytics.js`)
- UI 렌더링 자격증별 분리 (`analytics-loader.js`)
- index.html 자격증 선택 UI 및 이벤트 핸들러
- 폴더 구조 분리 (`exam-sports/`, `subjects-sports/`, ...)

🔜 **추가 작업 필요**
- `analytics.html`에 `certificateTypeChanged` 이벤트 리스너 추가
- 모든 차트 렌더링 함수에 자격증 필터링 적용 완료
- 생활스포츠지도사 실제 콘텐츠 추가 (현재 샘플만 존재)
- 성능 모니터링 (데이터 증가 시 마이그레이션 검토)

---

## 📞 문의 및 참고

- 자세한 폴더 구조: `CERT_STRUCTURE_GUIDE.md`
- 개발 규칙: `.cursorrules` (Linear Design System)
- 이슈 발생 시: 개발자 도구 콘솔에서 `🎯 자격증 전환:` 로그 확인


