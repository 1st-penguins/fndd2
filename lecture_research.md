# 동영상 강의 시스템 종합 분석 및 계획

> 작성일: 2026-03-17
> 목적: 동영상 강의 시스템의 현재 상태 분석, 보안 강화, 기능 확장 계획 수립

---

## 1. 현재 상태 분석

### 1-1. 구현 완료된 기능
| 기능 | 상태 | 비고 |
|------|------|------|
| 상품 등록/표시 | O | Firestore products 컬렉션 |
| 에피소드 + Vimeo 연동 | O | episodes 컬렉션, vimeoId 필드 |
| 구매 (Toss Payments) | O | 테스트키 상태, 심사중 |
| 쿠폰 시스템 | O | percent/fixed, 기간/횟수 제한 |
| 에피소드별 진도율 저장 | O | lectureProgress, 10초마다 저장 |
| 무료 에피소드 미리보기 | O | isFree: true 에피소드 |
| 구매 확인 후 재생 | O | 직접구매 + 패키지구매 + 관리자 체크 |
| 환불 정책 | O | 영상 30%/PDF 다운로드 기준 |

### 1-2. 미구현 기능 (빨간불)
| 기능 | 상태 | 우선순위 |
|------|------|----------|
| 동시접속 차단 | X | 1순위 |
| 마이페이지 | X | 1순위 |
| 전체 강의 진도율 표시 | X | 1순위 |
| 에피소드별 시청완료 배지 | X | 1순위 |
| 구매 기간 제한 (6개월/1년) | X | 2순위 (발판만) |
| Vimeo 도메인 제한 설정 | X | 1순위 |
| 워터마크/DRM | X | 검토 필요 |
| 마이페이지 (구매목록/기간) | X | 1순위 |

---

## 2. 동시접속 차단 (Session Token) - 1순위

### 2-1. 설계
```
[사용자 A - PC에서 재생]
  → 재생 시작 시 UUID 토큰 생성
  → Firestore users/{uid}/videoSessionToken에 저장
  → 30초마다 토큰 검증

[사용자 A - 다른 기기에서 재생]
  → 새 UUID 토큰 생성 → Firestore 덮어씀
  → 기존 PC의 토큰 불일치 → 재생 중단 + 안내
```

### 2-2. Firestore 구조
```javascript
// users/{uid} 문서에 필드 추가
{
  videoSessionToken: "uuid-xxxxx",      // 현재 활성 세션 토큰
  videoSessionStartedAt: Timestamp,     // 세션 시작 시간
  videoSessionProductId: "video_physio", // 현재 시청중인 상품
  videoSessionEpisode: 3                // 현재 시청중인 에피소드
}
```

### 2-3. 적용 범위
- **lecture-play.html에서만 동작** (영상 재생 페이지)
- 문제풀기/모의고사의 기존 세션(session-manager.js)과 **완전 분리**
- 기존 quiz session = `sessions` 컬렉션 (진행상태 추적용)
- 영상 session = `users/{uid}` 문서 필드 (동시접속 차단용)

### 2-4. 플로우
1. 영상 재생 시작 → `crypto.randomUUID()` 생성
2. Firestore `users/{uid}` 에 토큰 저장
3. 30초 간격으로 Firestore에서 토큰 조회
4. 현재 토큰 !== Firestore 토큰 → 재생 중단
5. 모달: "다른 기기에서 접속하여 현재 재생이 중단되었습니다."
6. Vimeo player pause + 화면 가림 처리

### 2-5. 주의사항
- 같은 기기의 다른 탭에서 열어도 차단됨 (의도된 동작)
- 브라우저 새로고침 시 새 토큰 생성 → 정상 동작
- 비정상 종료(탭 닫기) 시 토큰이 남아있지만, 다음 접속에서 덮어쓰므로 문제없음
- Firestore 보안규칙: 본인만 videoSessionToken 필드 읽기/쓰기 가능

---

## 3. 진도율 시스템 개선 - 1순위

### 3-1. 에피소드별 진도율 (현재 구현됨, 개선 필요)
```
현재: lectureProgress/{userId}_{productId}_ep{번호}
  → progress: 0~100 (%)
  → lastWatched: Timestamp

개선사항:
  → completed: true/false 추가 (90% 이상 시청 시 자동 완료 처리)
  → watchCount: 시청 횟수
  → totalWatchTime: 총 시청 시간 (초)
```

### 3-2. 전체 강의 진도율 (신규)
```
표시 위치: product-detail.html, 마이페이지
계산: 완료된 에피소드 수 / 전체 에피소드 수 × 100%

예시: 운동생리학 11강 중 4강 완료 → 36%

UI:
  ┌──────────────────────────────┐
  │ 전체 진도율  4/11강 (36%)    │
  │ ████████░░░░░░░░░░░░░░░░░░░ │
  └──────────────────────────────┘
```

### 3-3. 시청완료 배지
```
에피소드 목록에서:
  ✅ 1강 생체에너지학     58:35   [완료]
  ✅ 2강 운동대사         57:21   [완료]
  ▶  3강 호르몬           54:27   [시청중 62%]
  🔒 4강 신경계           55:36
  🔒 5강 골격근           56:25
  ...

완료 조건: progress >= 90% (또는 설정 가능)
```

### 3-4. 이어보기 기능
```
product-detail.html에서:
  "이어보기: 3강 호르몬 (62%에서 계속)" 버튼

lecture-play.html에서:
  에피소드 전환 시 이전 시청 위치(초)에서 재생 시작
  → Vimeo Player API: player.setCurrentTime(seconds)
```

---

## 4. 마이페이지 - 1순위

### 4-1. 접근 방식
- 헤더의 사용자 이름/아바타 클릭 → 마이페이지 이동
- URL: `mypage.html` 또는 `account.html`

### 4-2. 구성 요소
```
┌─────────────────────────────────────────────┐
│  마이페이지                                   │
├─────────────────────────────────────────────┤
│                                              │
│  👤 프로필                                    │
│  이름: 홍길동                                 │
│  이메일: hong@example.com                    │
│  가입일: 2026-01-15                          │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  📚 내 강의                                   │
│  ┌───────────────────────────────────────┐  │
│  │ 운동생리학 정규강의                      │  │
│  │ 구매일: 2026-03-01                     │  │
│  │ 이용기간: 2026-03-01 ~ 2026-09-01     │  │
│  │ 진도율: 4/11강 (36%)                   │  │
│  │ ████████░░░░░░░░░░░░░░░  [이어보기]    │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │ 기능해부학 요약본                        │  │
│  │ 구매일: 2026-03-05                     │  │
│  │ 다운로드 횟수: 3회                      │  │
│  │                           [다운로드]    │  │
│  └───────────────────────────────────────┘  │
│                                              │
├─────────────────────────────────────────────┤
│                                              │
│  🧾 결제 내역                                 │
│  2026-03-05  기능해부학 요약본    80,000원    │
│  2026-03-01  운동생리학 정규강의 150,000원    │
│                                              │
└─────────────────────────────────────────────┘
```

### 4-3. Firestore 데이터 소스
- 프로필: `auth.currentUser` (displayName, email, metadata.creationTime)
- 구매목록: `purchases` 컬렉션 where userId == uid
- 진도율: `lectureProgress` 컬렉션 where userId == uid
- 결제내역: `purchases` 컬렉션 (orderId, purchasedAt, productType 등)

---

## 5. 구매 기간 제한 - 2순위 (발판만)

### 5-1. 현재 상태
- 현재: "구매 후 무기한 시청 가능" (lifetime)
- 변경 계획: 6개월 또는 1년 제한

### 5-2. 데이터 구조 변경 (발판)
```javascript
// products 컬렉션에 필드 추가
{
  accessDurationDays: 180,  // 접근 가능 일수 (null이면 무기한)
  // 또는
  accessDurationMonths: 6   // 접근 가능 월수
}

// purchases 컬렉션에 필드 추가
{
  purchasedAt: Timestamp,
  expiresAt: Timestamp,     // purchasedAt + accessDuration 계산
  status: 'completed',      // → 'expired' (만료 시)
}
```

### 5-3. 접근 제어 변경 (나중에 구현)
```javascript
// 현재 코드
if (purchaseSnap.exists() && purchaseSnap.data().status === 'completed') {
  purchased = true;
}

// 변경 후
if (purchaseSnap.exists()) {
  const data = purchaseSnap.data();
  if (data.status === 'completed') {
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
      // 만료됨 → 접근 불가 + "기간 만료" 안내
      purchased = false;
    } else {
      purchased = true;
    }
  }
}
```

### 5-4. 현재 할 것 (발판만)
- purchases 문서에 `expiresAt` 필드 자리만 만들어두기
- products 문서에 `accessDurationDays` 필드 자리만 만들어두기
- 실제 만료 체크 로직은 나중에 구현
- UI에서 "구매 후 무기한 시청 가능" 문구는 유지하되, 마이페이지에서 이용기간 표시 준비

---

## 6. 보안 강화 - 1순위

### 6-1. Vimeo 설정 (즉시 필요)

#### 반드시 해야 할 것
| 설정 | 방법 | 상태 |
|------|------|------|
| 도메인 제한 | Vimeo → 각 영상 → Privacy → Embed → "Specific domains" → `the1stpeng.com` 입력 | **미설정** |
| 비공개 설정 | Privacy → Who can watch → "Only people with the private link" 또는 "Hide from Vimeo" | **미설정** |
| 다운로드 비활성화 | 각 영상 → Settings → General → Downloads → Off | **미설정** |

#### Vimeo API로 일괄 설정 가능
```bash
# 도메인 제한 + 비공개 + 다운로드 비활성화 일괄 적용
curl -X PATCH "https://api.vimeo.com/videos/{videoId}" \
  -H "Authorization: bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "privacy": {
      "view": "disable",
      "embed": "whitelist",
      "download": false
    },
    "embed": {
      "domains": ["the1stpeng.com"]
    }
  }'
```

### 6-2. 플랫폼 보안 체크리스트

| 보안 항목 | 현재 | 목표 | 방법 |
|-----------|------|------|------|
| Vimeo 도메인 제한 | X | O | API로 일괄 설정 |
| Vimeo 비공개 설정 | X | O | API로 일괄 설정 |
| 다운로드 비활성화 | X | O | API로 일괄 설정 |
| 동시접속 차단 | X | O | Session Token 구현 |
| 구매 확인 후 embed | O | O | 유지 |
| Firestore 보안규칙 | O | O | 유지 |
| HTTPS 전용 | O | O | Firebase Hosting 기본 |

### 6-3. 커스텀 워터마크 (JS 오버레이)

Vimeo는 **동적 워터마크를 지원하지 않음**. 자체 구현 필요:

```
┌──────────────────────────────────┐
│                                  │
│    [ Vimeo 영상 재생 영역 ]       │
│                                  │
│         hong@example.com         │  ← 반투명 텍스트 오버레이
│                                  │
│                                  │
└──────────────────────────────────┘
```

#### 구현 방식
```javascript
// lecture-play.html에서 비메오 iframe 위에 오버레이
const overlay = document.createElement('div');
overlay.style.cssText = `
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none; z-index: 10;
  display: flex; align-items: center; justify-content: center;
`;
overlay.innerHTML = `
  <span style="color: rgba(255,255,255,0.15); font-size: 18px;
    transform: rotate(-30deg); user-select: none;">
    ${user.email}
  </span>
`;
videoContainer.style.position = 'relative';
videoContainer.appendChild(overlay);
```

#### 한계
- JS 오버레이는 개발자 도구로 제거 가능 (100% 방어 불가)
- 하지만 **일반 사용자 수준의 녹화 공유는 충분히 억제**
- 완벽한 DRM이 필요하면 Vimeo Enterprise($$$) 또는 VdoCipher 전환 필요

---

## 7. Vimeo 대안 검토

### 7-1. 현재 Vimeo 플랜 분석

| 기능 | Free | Starter($12/월) | Standard($25/월) | Advanced($75/월) | Enterprise(문의) |
|------|------|-----------------|-------------------|-------------------|-------------------|
| 도메인 제한 | X | O | O | O | O |
| 다운로드 비활성화 | O | O | O | O | O |
| DRM | X | X | X | X | **O** |
| 동적 워터마크 | X | X | X | X | X |
| 화면녹화 차단 | X | X | X | X | O (DRM) |

### 7-2. VdoCipher (대안)
- **가격**: 약 $12/월 (연 $145~)
- **DRM**: Widevine + FairPlay 기본 포함
- **동적 워터마크**: 시청자 이메일/IP 실시간 표시 (기본 포함!)
- **화면녹화 차단**: DRM으로 지원
- **장점**: 교육 플랫폼에 특화, Vimeo Enterprise 수준 보안을 저가에 제공
- **단점**: Vimeo에서 마이그레이션 필요, UI가 Vimeo만큼 세련되지 않음

### 7-3. 현실적 판단
```
현재 단계 (MVP):
  → Vimeo Starter/Standard 유지
  → 도메인 제한 + 비공개 + 다운로드 비활성화
  → 커스텀 JS 워터마크 (이메일 오버레이)
  → 동시접속 차단 (Session Token)
  → 이 정도면 일반 사용자의 무단 공유 충분히 억제

성장 후 (수강생 많아졌을 때):
  → VdoCipher 전환 검토 (DRM + 동적 워터마크)
  → 또는 Vimeo Enterprise (비용 대비 효과 따져봐야)
```

---

## 8. 구현 우선순위 정리

### Phase 1 - 즉시 (보안 + 기본 기능)
1. **Vimeo 도메인 제한/비공개 일괄 설정** (API 스크립트)
2. **동시접속 차단** (Session Token)
3. **에피소드별 시청완료 배지** (progress >= 90% → completed)
4. **전체 강의 진도율** (product-detail.html)

### Phase 2 - 이번주 내
5. **마이페이지** (구매목록 + 진도율 + 결제내역)
6. **커스텀 워터마크** (JS 이메일 오버레이)
7. **이어보기 기능** (마지막 시청 위치에서 재개)

### Phase 3 - 발판만 (나중에)
8. **구매 기간 제한** (expiresAt 필드 추가만)
9. **패키지 상품** (전과목 패키지 등)
10. **VdoCipher 전환 검토** (사용자 증가 시)

---

## 9. 기술적 TODO

### Firestore 컬렉션 변경사항
```
products/{productId}
  + accessDurationDays: number | null     // 발판 - 접근 가능 일수

purchases/{purchaseId}
  + expiresAt: Timestamp | null           // 발판 - 만료일

users/{uid}
  + videoSessionToken: string             // 동시접속 차단
  + videoSessionStartedAt: Timestamp
  + videoSessionProductId: string
  + videoSessionEpisode: number

lectureProgress/{userId}_{productId}_ep{번호}
  + completed: boolean                    // 시청완료 여부
  + watchCount: number                    // 시청 횟수
  + totalWatchTime: number                // 총 시청 시간(초)
  + lastPosition: number                  // 마지막 재생 위치(초) - 이어보기용
```

### 신규 페이지
```
mypage.html          — 마이페이지
```

### 수정 필요 파일
```
lecture-play.html            — 동시접속 차단 + 워터마크 + 완료 배지 + 이어보기
product-detail.html          — 전체 진도율 + 시청완료 배지 + 이어보기 버튼
js/payment/lecture-tracker.js — completed/watchCount/lastPosition 필드 추가
js/linear-header.js          — 마이페이지 링크 추가
firestore.rules              — users 컬렉션 videoSession 필드 규칙 추가
```

### Vimeo API 스크립트 (일괄 보안 설정)
```
vimeo-secure.js  — 전체 영상 도메인제한 + 비공개 + 다운로드OFF 일괄 적용
```

---

## 10. 결론

**현재 가장 시급한 것:**
1. Vimeo 보안 설정 (도메인 제한) — 지금 아무 설정 없이 embed URL만 알면 누구나 시청 가능
2. 동시접속 차단 — 한 계정으로 여러 명이 동시 시청 가능한 상태
3. 마이페이지 — 구매자가 자신의 강의/진도를 확인할 곳이 없음

**괜찮은 것:**
- 구매 확인 로직은 잘 되어있음 (직접구매 + 패키지 + 관리자)
- 환불 정책 기준 (30% 시청률) 추적이 구현되어 있음
- Firestore 보안규칙이 적절하게 설정되어 있음

**나중에 해도 되는 것:**
- 구매 기간 제한 (발판만 깔아두면 됨)
- VdoCipher 전환 (사용자 증가 시)
- 패키지 상품 (번들)
