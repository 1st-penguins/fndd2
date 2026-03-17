# 집에서 할 것 목록

## 0. 코드 가져오기 (터미널에서)
```
cd fndd2
git fetch
git checkout shop-dev
git pull
```

## 0-1. service-account-key.json 준비
Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성"
→ 다운받은 파일을 fndd2 폴더에 `service-account-key.json`으로 저장
(.gitignore에 추가되어있어서 push해도 안 올라감)

---

## 1. Vimeo 에피소드 연결 (핵심!)
각 인강 상품에 Vimeo 영상을 연결해야 함.
팀원한테 받은 Vimeo ID로 Firestore `episodes` 컬렉션에 등록.

### 등록 방법
scripts/ 폴더에 등록 스크립트를 만들어서 node로 실행하면 됨.
예시:
```javascript
// episodes 등록 예시 (1과목)
{ productId: 'video_physio', episode: 1, title: '1강 제목', vimeoId: '비메오ID', duration: '32분', isFree: true, sortOrder: 1 }
{ productId: 'video_physio', episode: 2, title: '2강 제목', vimeoId: '비메오ID', duration: '28분', isFree: false, sortOrder: 2 }
```

### 등록할 상품 목록 (인강 8개)
- video_physio (운동생리학)
- video_patho (병태생리학)
- video_anatomy (기능해부학)
- video_prescript (운동처방론)
- video_load (운동부하검사)
- video_injury (운동상해)
- video_health (건강체력평가)
- video_ecg (심전도)

### Firestore products의 totalEpisodes, totalDuration도 업데이트 필요

---

## 2. 테스트 결제 플로우 확인
1. localhost:8000 접속
2. 강의 탭 → 상품 카드 클릭
3. 상세 페이지 확인
4. 구매하기 → 결제 페이지 → 테스트 결제
5. 결제 성공 페이지 확인
6. 강의 재생 페이지에서 Vimeo 영상 재생 확인
7. PDF 다운로드 확인

---

## 3. 확인해야 할 것
- [ ] 심전도(video_ecg) — 인강? PDF? 둘 다? (팀원 확인)
- [ ] 패키지 상품 — 만들 건지, 가격은? (팀원 확인)
- [ ] 토스페이먼츠 심사 결과 (1~3일)

---

## 4. 나중에 할 것 (급하지 않음)
- Cloud Functions (결제 서버 검증) — 실결제 전 필수
- PDF 워터마크 — Cloud Functions에서 처리
- 내 구매 목록 (학습분석 탭)
- 토스 실서비스 키 교체 (심사 통과 후)

---

## 5. 완성 후 배포
```
git checkout main
git merge shop-dev
git push
```
이때 main에 합치면 Cloudflare Pages에서 자동 배포됨.
