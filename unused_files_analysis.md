# 미사용 HTML 파일 분석

## 🔍 분석 결과

### ✅ 사용 중인 페이지 (삭제 불가)

#### 메인 페이지
- ✅ `index.html` - 메인 홈페이지
- ✅ `login.html` - 로그인 페이지
- ✅ `notices.html` - 공지사항 목록
- ✅ `notices/detail.html` - 공지사항 상세
- ✅ `contact.html` - 문의 페이지
- ✅ `company-info.html` - 사업자 정보
- ✅ `refund-policy.html` - 환불 정책

#### 문제 풀이 페이지
- ✅ `subjects/*.html` (8개) - 과목별 문제
- ✅ `years/*.html` (7개) - 연도별 문제
- ✅ `exam/*.html` (71개) - 시험 페이지

#### 학습 분석
- ✅ `analytics.html` - 학습 분석 대시보드 (index.html과 quiz.html에서 링크)

#### 강의 시스템 (준비중/미래 기능)
- ✅ `lectures.html` - 강의 목록 (헤더에서 링크)
- ✅ `lecture-purchase.html` - 강의 구매 (lectures.html에서 링크)
- ✅ `lecture-play.html` - 강의 재생 (lectures.html에서 링크)
- ✅ `lecture-success.html` - 결제 완료 (결제 플로우)
- ✅ `lecture-fail.html` - 결제 실패 (결제 플로우)
- ✅ `pdf-download.html` - PDF 다운로드 (lectures.html에서 링크)

#### 관리자 페이지
- ✅ `admin/dashboard.html` - 관리자 대시보드
- ✅ `admin/notices.html` - 공지사항 관리
- ✅ `admin/coupons.html` - 쿠폰 관리

---

### ⚠️ 링크 없는 페이지 (사용 여부 확인 필요)

#### 1. `admin-notices.html` ❌
- **위치**: 루트 디렉터리
- **상태**: 어디에서도 링크되지 않음
- **중복**: `admin/notices.html`과 기능 중복으로 보임
- **권장**: 삭제 또는 `admin/notices.html`과 통합

#### 2. `admin/statistics.html` ⚠️
- **위치**: admin 폴더
- **상태**: dashboard에서 링크 없음
- **기능**: 통계 페이지 (예정된 기능일 수 있음)
- **권장**: 사용 계획이 없으면 삭제

#### 3. `admin/migrate-data.html` ⚠️
- **위치**: admin 폴더
- **상태**: dashboard에서 링크 없음
- **기능**: 데이터 마이그레이션 (개발용 도구)
- **권장**: 개발 완료 후 삭제 가능

#### 4. `admin/generate-summary-stats.html` ⚠️
- **위치**: admin 폴더
- **상태**: dashboard에서 링크 없음
- **기능**: 통계 생성 (개발용 도구)
- **권장**: 개발 완료 후 삭제 가능

#### 5. `admin/fix-encoded-subjects.html` ⚠️
- **위치**: admin 폴더
- **상태**: dashboard에서 링크 없음
- **기능**: 인코딩 수정 (개발용 도구)
- **권장**: 개발 완료 후 삭제 가능

---

## 💡 권장 조치

### 즉시 삭제 가능 (개발용 도구)
```
admin/migrate-data.html
admin/generate-summary-stats.html
admin/fix-encoded-subjects.html
```
→ 이미 데이터 마이그레이션과 수정 작업이 완료되었다면 삭제 가능

### 검토 후 결정
```
admin-notices.html → admin/notices.html과 중복 확인 필요
admin/statistics.html → 향후 사용 계획 확인 필요
```

---

## 🔗 링크 구조 정리

### 메인 네비게이션 (헤더)
```
index.html
  ├─ 홈 (index.html)
  ├─ 강의 (lectures.html)
  │   ├─ lecture-purchase.html
  │   ├─ lecture-play.html
  │   ├─ lecture-success.html
  │   ├─ lecture-fail.html
  │   └─ pdf-download.html
  ├─ 공지사항 (notices.html)
  │   └─ notices/detail.html
  └─ 문의 (contact.html)
```

### 푸터 링크
```
├─ 공지사항 (notices.html)
├─ 문제풀기 (index.html)
├─ 문의하기 (contact.html)
├─ 환불정책 (refund-policy.html)
└─ 사업자정보 (company-info.html)
```

### 문제풀기 시스템
```
index.html (quiz 탭)
  ├─ subjects/ (과목별)
  │   ├─ 운동생리학
  │   ├─ 건강체력평가
  │   ├─ 운동처방론
  │   ├─ 운동부하검사
  │   ├─ 운동상해
  │   ├─ 기능해부학
  │   ├─ 병태생리학
  │   └─ 스포츠심리학
  └─ years/ (연도별)
      ├─ 2019~2025
      └─ exam/ (각 연도별 세부 문제)
```

### 관리자 시스템
```
admin/dashboard.html
  ├─ 공지관리 (admin/notices.html)
  └─ 쿠폰관리 (admin/coupons.html)

⚠️ 링크 없음:
  ├─ admin/statistics.html
  ├─ admin/migrate-data.html
  ├─ admin/generate-summary-stats.html
  └─ admin/fix-encoded-subjects.html
```

---

## 📊 파일 개수 통계

- **전체 HTML**: 108개
- **사용 중 확인**: 100개
- **링크 없음**: 5개
- **중복 의심**: 1개 (admin-notices.html)

---

## ✅ 최종 권장사항

### 즉시 삭제 추천 (개발 도구)
1. `admin/migrate-data.html`
2. `admin/generate-summary-stats.html`
3. `admin/fix-encoded-subjects.html`

### 검토 후 삭제
4. `admin-notices.html` (admin/notices.html과 비교 후)
5. `admin/statistics.html` (향후 계획 확인 후)

**삭제하면 약 5개 파일 정리 가능**

