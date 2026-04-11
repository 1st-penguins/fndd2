# 리틀리 → 홈페이지 강의 이전 기록

## 개요

리틀리(littly)에서 판매한 건강운동관리사 정규강의를 홈페이지(the1stpeng.com) Firestore `purchases` 컬렉션으로 이전하는 작업.
홈페이지 리뉴얼 기념으로 **전원 구매일 무관하게 수강기간 6개월(180일) 새로 부여**.

## 이전 대상

- **정규강의(동영상)만 이전** (10만~15만원)
- 요약본(PDF, 5만~8만원)은 이전 대상 아님 (이미 다운로드 완료된 상품)
- 심전도/계산문제 특별강의(5만~10만원)는 동영상이므로 이전 대상
- CSCS/스페셜테스트는 이전 대상 아님

## 리틀리 상품명 → productId 매핑

| 리틀리 상품명 (키워드) | productId | 가격대 |
|----------------------|-----------|--------|
| 운동생리학 정규강의 | video_physio | 15만 |
| 운동부하검사 정규강의 | video_load | 15만 |
| 운동처방론 정규강의 | video_prescript | 10만 |
| 운동상해 정규강의 | video_injury | 15만 |
| 기능해부학 정규강의 | video_anatomy | 15만 |
| 병태생리학 정규강의 | video_patho | 15만 |
| 건강체력평가 정규강의 | video_health | 15만 |
| 심전도 특별강의 | video_ecg | 5만 |
| 계산문제 특별강의 | video_calc | 7~10만 |

### 주의: 동일 키워드 요약본과 구분하는 법
- 상품명에 "정규강의"가 명시되어 있으면 확실히 동영상
- 없으면 **금액**으로 구분: 10만원 이상 = 정규강의, 5만원 = 요약본, 8만원 = 기능해부학 요약본
- **예외**: 심전도(5만원), 계산문제(7~10만원)는 금액 낮지만 동영상강의

## Firestore 등록 형식

```
문서ID: {userId}_{productId}
{
  userId, userEmail, userName, productId,
  amount: 0,
  paymentMethod: '리틀리 이전',
  status: 'completed',
  purchasedAt: 등록일,
  expiresAt: 등록일 + 180일,
  note: '리틀리 구매 이전 (원래 이메일: xxx)' // 이메일이 다른 경우
}
```

## 처리 완료 현황 (DB 기준, 2026-04-09)

### 이메일 동일 (리틀리 = 홈페이지) — 15명

| 이름 | 이메일 | 등록된 상품 | 만료일 |
|------|--------|-----------|--------|
| 방재휘 | bjaehwi01@naver.com | physio, anatomy, injury, prescript, load, patho, health (7건) | 2026.10.5~6 |
| 전경록 | fhrxoddl97@gmail.com | load, health (2건) | 2026.10.5~6 |
| 한아름 | haruem0909@gmail.com | physio, injury (2건) | 2026.10.5 |
| 정택권 | jeongtaeggwon@gmail.com | load, prescript (2건) | 2026.10.5 |
| 김종진 | johnnykim766@gmail.com | calc, patho (2건) | 2026.10.5~6 |
| 김정민 | lalala8395@gmail.com | load (1건) | 2026.10.5 |
| 이영선 | littleyoung2@naver.com | prescript, anatomy, physio, patho (4건) | 2026.10.5~6 |
| 백나래 | naraert45@naver.com | physio (1건) | 2026.10.5 |
| 임나연 | nayeon5771@naver.com | ecg (1건) | 2026.10.5 |
| 김준서 | poi5916@gmail.com | physio, anatomy, health, patho (4건) | 2026.10.5~6 |
| 김성민 | rlatjdals2380@hanmail.net | calc (1건) | 2026.10.5 |
| 남영민 | skaduals110@naver.com | physio, load (2건) | 2026.10.5 |
| 박시영 | sopia1985@hanmail.net | anatomy (1건) | 2026.10.5 |
| 조승현 | whtmdgus0327@naver.com | load (1건) | 2026.10.5 |
| 신상원 | nowgnas00@naver.com | physio (1건) | 2026.10.6 |

### 이메일 다름 (회신 받아 처리) — 4명

| 이름 | 리틀리 이메일 | 홈페이지 이메일 | 등록된 상품 | 처리일 |
|------|-------------|---------------|-----------|--------|
| 황요벨 | hyobel@naver.com | hyobel0226@gmail.com | ecg, calc (2건) | 2026-04-08 |
| 박민기 | mkp0413@naver.com | mkp0413@gmail.com | load (1건) | 2026-04-08 |
| 허석범 | hsb5593@naver.com | seokbeom97@gmail.com | physio, anatomy, load, health (4건) | 2026-04-09 |
| 장형빈 | qqwwee2018@naver.com | gudqls2018@gmail.com | ecg (1건) | 2026-04-08 |

### 회신 대기 중 — 14명 (홈페이지 미가입 또는 다른 이메일)

| 이름 | 리틀리 이메일 | 리틀리 정규강의 구매 내역 |
|------|-------------|------------------------|
| 신은지 | angieshin92@gmail.com | physio |
| 신관옥 | calvary1994@naver.com | physio |
| 최영민 | cym991226@naver.com | physio |
| 남서윤 | epdlqmf1026@naver.com | physio |
| 김재현 | jesskim0729@naver.com | calc |
| 김준영 | kjyyyyy0@naver.com | physio |
| 김건우 | kkungcheda@naver.com | prescript |
| 이유정 | leeyj01588@gmail.com | prescript, load, physio, injury |
| 이영일 | lyez@naver.com | calc |
| 이병수 | qudtnsla2010@naver.com | ecg |
| 이승호 | skdi614@naver.com | prescript, ecg, injury, physio |
| 이승현 | tmdgusfifa@naver.com | physio |
| 손준호 | wnsgh8268@naver.com | prescript, load, injury |
| 최재혁 | wogur4825@naver.com | ecg |

> **주의**: 회신 대기자의 구매 내역은 초기 분석(2026-04-08) 기준이며, 이후 추가 구매가 있을 수 있음.
> 처리 시 반드시 최신 CSV(`리틀리 주문 - Sheet1.csv`)에서 10만원 이상 정규강의 + 심전도/계산문제를 다시 확인할 것.

## CSV 파일

- `리틀리 주문 - Sheet1.csv` 또는 `리틀리 주문 - Sheet1 (1).csv` — 리틀리 전체 주문 내역
- 최신 파일을 사용할 것

## 이전 처리 절차 (회신 받았을 때)

1. 홈페이지 가입 이메일 확인
2. Firebase Auth에서 UID 조회: `admin.auth().getUserByEmail(email)`
3. 최신 CSV에서 해당 리틀리 이메일의 **10만원 이상 정규강의 + 심전도/계산문제** 필터
4. Firestore `purchases` 컬렉션에 등록 (위 형식 참고)
5. 본 문서의 처리 현황 업데이트

## 관리자 제외

- mingdy7283@gmail.com (강민지) — 관리자이므로 이전 대상 아님

## 작업 이력

- 2026-04-08: 동일이메일 14명 일괄 등록 (24건), 황요벨/박민기 회신 처리
- 2026-04-09: 허석범 회신 처리 (physio, anatomy, load, health 4건)
- 2026-04-09: 장형빈 처리 확인 (ecg 1건, 직접 처리)
- 2026-04-09: 신상원 처리 (physio 1건, 리틀리 당일 구매)
- 2026-04-09: 누락 점검 — 요약본(5만원)과 정규강의(10만원+) 구분 오류 발견, 정규강의 7건 추가 등록 (방재휘 patho/health, 전경록 health, 김종진 patho, 이영선 patho, 김준서 health/patho)
