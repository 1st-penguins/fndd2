# 간단한 Netlify 배포 가이드

## 🚀 문제 해결: TypeScript 빌드 오류

### 문제 원인
- 프로젝트가 정적 HTML 사이트인데 React/Vite 빌드 설정이 되어 있음
- `package.json`의 `build` 스크립트가 TypeScript 컴파일을 시도함

### 해결 방법
1. **빌드 명령어 제거**: `netlify.toml`에서 빌드 과정 제거
2. **정적 사이트로 설정**: 빌드 없이 직접 파일 배포

## 📁 배포 방법

### 방법 1: Netlify CLI (추천)
```bash
# 1. Netlify CLI 설치
npm install -g netlify-cli

# 2. 로그인
netlify login

# 3. 배포 (빌드 과정 없이)
netlify deploy --dir . --prod
```

### 방법 2: 드래그 앤 드롭
1. 프로젝트 폴더를 압축 (ZIP 파일)
2. [Netlify 대시보드](https://app.netlify.com/) 접속
3. "Sites" → "Add new site" → "Deploy manually"
4. ZIP 파일을 드래그 앤 드롭

### 방법 3: GitHub 연동
1. GitHub에 프로젝트 푸시
2. Netlify에서 GitHub 저장소 연결
3. 빌드 설정에서 "Build command" 비워두기
4. "Publish directory"를 `.` (루트)로 설정

## ⚙️ Netlify 설정

### 빌드 설정
```
Build command: (비워둠)
Publish directory: . (또는 비워둠)
```

### 환경 변수 (필요한 경우)
```
NODE_ENV=production
```

## 🔥 Firebase 설정 확인

### 1. Firebase 프로젝트 설정
- Firebase Console → Project Settings
- "Your apps" → Web app 설정 확인
- 도메인 허용 설정 확인

### 2. 도메인 등록
```
# Firebase Console → Authentication → Settings
Authorized domains에 다음 추가:
- your-site.netlify.app
- your-custom-domain.com
```

### 3. Firestore 보안 규칙
```javascript
// rules/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근 가능
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 공지사항은 모든 사용자가 읽기 가능
    match /notices/{noticeId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 🧪 배포 후 테스트

### 1. 기본 기능 테스트
- [ ] 홈페이지 로드 확인
- [ ] 테마 전환 기능 확인
- [ ] 반응형 디자인 확인

### 2. Firebase 연동 테스트
- [ ] `firebase-test.html` 페이지 접속
- [ ] Firebase 연결 상태 확인
- [ ] 인증 기능 테스트
- [ ] 데이터베이스 연결 테스트

### 3. 성능 테스트
- [ ] 페이지 로딩 속도 확인
- [ ] 이미지 로딩 확인
- [ ] 모바일 성능 확인

## 🐛 문제 해결

### 일반적인 문제들

#### 1. 빌드 오류
```
문제: Build script returned non-zero exit code
해결: netlify.toml에서 빌드 명령어 제거
```

#### 2. Firebase 연결 오류
```
문제: Firebase 초기화 실패
해결: 도메인 허용 설정 확인
```

#### 3. CORS 오류
```
문제: Cross-origin request blocked
해결: Firebase Console에서 도메인 추가
```

## 📋 배포 체크리스트

### 배포 전 확인
- [ ] `netlify.toml` 파일 수정 완료
- [ ] `package.json` 빌드 스크립트 수정 완료
- [ ] Firebase 설정 확인
- [ ] 모든 파일이 프로젝트에 포함되어 있는지 확인

### 배포 후 확인
- [ ] 사이트 정상 로드
- [ ] Firebase 연동 정상 작동
- [ ] 테마 전환 기능 정상 작동
- [ ] 모바일에서 정상 작동

## 🎯 최종 배포 명령어

```bash
# Netlify CLI로 배포
netlify deploy --dir . --prod

# 또는 특정 사이트로 배포
netlify deploy --dir . --prod --site your-site-name
```

---

**이제 TypeScript 빌드 오류 없이 배포할 수 있습니다!** 🚀
