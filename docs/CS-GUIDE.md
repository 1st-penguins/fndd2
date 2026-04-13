# CS 대응 가이드

고객 문의 대응 시 참고하는 문서입니다. 자주 발생하는 유형별로 확인 방법, 해결 방법, 답변 템플릿을 정리합니다.

---

## 1. PDF 다운로드 관련

### 1-1. "다운로드 횟수 초과" 문의

**원인**: 패키지 상품(pdf_si2_package)은 파일별 2회 다운로드 제한. 다운 실패해도 횟수 차감됨.

**확인 방법**:
```bash
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceaccountkey.json')) });
admin.firestore().collection('pdfDownloads').where('userId', '==', 'UID').get().then(s => {
  s.forEach(d => console.log(d.id, JSON.stringify(d.data().fileDownloads)));
  process.exit(0);
});
"
```

**해결**: 다운로드 횟수 초기화
```bash
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceaccountkey.json')) });
admin.firestore().collection('pdfDownloads').doc('UID_PRODUCTID').update({
  'fileDownloads.si2-social': 0,
  'fileDownloads.si2-ethics': 0,
  'fileDownloads.si2-psycho': 0,
  'fileDownloads.si2-history': 0,
  'fileDownloads.si2-education': 0,
}).then(() => { console.log('OK'); process.exit(0); });
"
```

**답변 템플릿**:
> 안녕하세요, 퍼스트펭귄입니다 :)
>
> 먼저 불편을 드려 정말 죄송합니다.
> 다운로드 횟수를 초기화해드렸습니다!
>
> 마이페이지 → 다운로드 버튼을 누르시면 아래 5과목 요약본을 각각 다운받으실 수 있습니다.
>
> ① 스포츠사회학
> ② 스포츠윤리
> ③ 스포츠심리학
> ④ 한국체육사
> ⑤ 스포츠교육학
>
> 다운로드 페이지에 들어가시면 5개 파일이 나열되어 있고, 각 파일 옆의 [다운로드] 버튼을 하나씩 눌러주시면 됩니다.
>
> 혹시 어려운 점이 있으시면 언제든 편하게 문의해주세요.
> 합격까지 퍼스트펭귄이 함께하겠습니다!

### 1-2. "파일이 저장이 안 됩니다" (특정 과목만)

**원인**: 파일 용량이 큰 경우(심리학 57MB 등) 모바일/느린 네트워크에서 타임아웃 발생 가능.

**파일 크기 참고**:
| 과목 | 용량 |
|------|------|
| 스포츠교육학 | 10.9MB |
| 스포츠윤리 | 31.5MB |
| 스포츠사회학 | 32.8MB |
| 한국체육사 | 43.1MB |
| 스포츠심리학 | 56.7MB |

**답변 추가 문구** (횟수 초기화 답변에 추가):
> 해당 파일은 용량이 약 57MB로 다른 과목보다 큰 편이라, 네트워크 환경에 따라 저장이 안 되는 경우가 있을 수 있습니다.
>
> 원활한 다운로드를 위해:
> 1. Wi-Fi 환경에서 다운로드
> 2. 모바일보다는 PC에서 다운로드
> 3. 브라우저가 멈추더라도 잠시 기다려주시면 저장됩니다

### 1-3. 아이폰 다운로드 파일 위치

**Safari로 다운받은 경우**:
> "파일" 앱 → 둘러보기 → 나의 iPhone → 다운로드 폴더
> 또는 Safari 주소창 왼쪽 "가가" 버튼 → 다운로드

**Chrome으로 다운받은 경우**:
> "파일" 앱 → 둘러보기 → 나의 iPhone → Chrome 폴더
> 또는 Chrome 앱 → 우측 하단 ⋯ → 다운로드 탭

---

## 2. 리뷰어/무료 제공 등록

### 2-1. 리뷰어 전체 상품 등록

**스크립트**: `scripts/grant-reviewer.js`
```bash
# 드라이런 (확인만)
node scripts/grant-reviewer.js 이메일@gmail.com --dry-run

# 실행
node scripts/grant-reviewer.js 이메일@gmail.com
```
- products 컬렉션에서 활성 상품 전체를 조회하여 0원/리뷰어 제공으로 등록
- 이미 등록된 상품은 자동 스킵
- `--include=pdf,video` 또는 `--exclude=pdf_001` 옵션 가능

### 2-2. 특정 상품만 등록

Firebase Auth에서 uid 확인 후 purchases 직접 추가:
```bash
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceaccountkey.json')) });
const db = admin.firestore();
const uid = 'UID';
const pid = 'pdf_si2_package';
db.collection('purchases').doc(uid+'_'+pid).set({
  userId: uid, userEmail: '이메일', userName: '이름',
  productId: pid, productType: 'package',
  purchaseAmount: 0, finalAmount: 0, discountAmount: 0,
  paymentMethod: '리뷰어 제공', status: 'completed',
  orderId: 'reviewer_'+uid+'_'+pid,
  purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
}).then(() => { console.log('OK'); process.exit(0); });
"
```

---

## 3. 리틀리 구매자 이전

**절차**:
1. 리틀리 주문 CSV에서 구매자 이메일 확인
2. 홈페이지 계정 이메일 확인 (다를 수 있음)
3. Firebase Auth에서 uid 조회
4. purchases에 `paymentMethod: '리틀리 이전'`, `finalAmount: 0`으로 등록

**주의**: 사이트 미가입 상태면 먼저 가입 안내 후 처리.

**답변 템플릿 (미가입 시)**:
> 리틀리에서 구매하신 상품을 홈페이지에서 이용하실 수 있도록 연동해드리겠습니다.
>
> 먼저 the1stpeng.com에 회원가입 부탁드립니다.
> 가입 완료되시면 이 메일에 답장으로 알려주세요!

**답변 템플릿 (이미 가입)**:
> 확인해보니 OOO@gmail.com 계정에 해당 강의가 이미 연동되어 있습니다!
> the1stpeng.com → 로그인 → 마이페이지에서 확인해주세요.

---

## 4. 해설 오류/이의제기

**대응 절차**:
1. 해당 문제 이미지 확인 (`images-sports/연도/과목/문제 (N).png`)
2. JSON 파일에서 correctAnswer, explanation 확인
3. 필요시 웹 검색으로 정확한 정보 확인
4. JSON 수정 후 `firebase deploy --only hosting`

**JSON 위치**: `data/sports/{연도}_{과목명}.json`

**주의사항**:
- correctAnswer는 0-based (1번=0, 2번=1, 3번=2, 4번=3)
- 복수정답: `[0, 2]` (1,3번 정답)
- 전원정답: `[0, 1, 2, 3]`

---

## 5. 강의 관련 문의

### 5-1. ACSM 판본 문의

> 운동처방론 정규강의는 ACSM 11판을 기준으로 촬영되었습니다.
> 12판에서 변경된 내용은 운동처방론 요약본(PDF)에 별도로 정리하여 반영해두었으니 함께 활용하시면 최신 기준까지 빠짐없이 학습하실 수 있습니다.

---

## 6. Google Drive 파일 접근 요청

**상황**: 외부 사용자가 Drive에 있는 PDF 파일에 접근 요청 메일을 보내는 경우.

**대응**:
1. 요청자 이메일이 사이트 결제자인지 확인
2. 미결제자 → 거절 (무시)
3. Drive 파일 공유 상태 확인 → "제한됨"으로 변경
4. 링크 유출이 의심되면 파일 삭제 후 재업로드 (URL 사멸)

**확인 스크립트** (이메일로 구매 이력 조회):
```bash
node -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceaccountkey.json')) });
const db = admin.firestore();
db.collection('purchases').where('userEmail', '==', '이메일').get().then(s => {
  console.log(s.size + '건');
  s.forEach(d => { const p = d.data(); console.log(p.productId, p.finalAmount+'원', p.status); });
  process.exit(0);
});
"
```

**중요**: 사이트 PDF는 Firebase Storage에 있으므로 Google Drive로 직접 공유하지 말 것. 구매자에게는 사이트 마이페이지 다운로드 안내.

---

## 7. 공통 답변 톤

- 첫 줄: "안녕하세요, 퍼스트펭귄입니다 :)"
- 불편 사항이면: "불편을 드려 죄송합니다" 먼저
- 해결 조치 명시 후 구체적 안내 (번호 목록)
- 마지막: "합격까지 퍼스트펭귄이 함께하겠습니다!"
- 추가 문의 유도: "어려운 점이 있으시면 언제든 편하게 문의해주세요"

---

## 변경 이력

- **2026-04-12** 초안 작성. PDF 다운로드, 리뷰어 등록, 리틀리 이전, 해설 수정, Drive 접근 대응 정리.
