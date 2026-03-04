# 로컬 개발 환경 설정 가이드

## 🚀 데이터베이스 없이 홈페이지 체험하기

### 🎯 가장 간단한 방법 (추천!)

#### 1. 자동 실행 스크립트 사용

**Windows 사용자:**
```bash
# 배치 파일 실행
start-dev-server.bat
```

**Mac/Linux 사용자:**
```bash
# 스크립트 실행 권한 부여
chmod +x start-dev-server.sh

# 서버 시작
./start-dev-server.sh
```

#### 2. 브라우저에서 확인
- **개발용 홈페이지**: http://localhost:8000/index-dev.html
- **테마 테스트**: http://localhost:8000/theme-test.html
- **기존 홈페이지**: http://localhost:8000/index.html

### 🛠️ 수동으로 서버 실행하기

#### Python이 설치된 경우
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

#### Node.js가 설치된 경우
```bash
# npx 사용
npx serve . -p 8000

# 또는 http-server 설치
npm install -g http-server
http-server -p 8000
```

#### VS Code 사용하는 경우
- Live Server 확장 프로그램 설치
- `index-dev.html` 우클릭 → "Open with Live Server"

### 🎭 Mock 데이터 시스템

#### 생성된 파일들
- `index-dev.html` - Mock 데이터를 사용하는 개발용 홈페이지
- `js/mock-data.js` - 모든 Mock 데이터와 API 함수들
- `start-dev-server.bat` / `start-dev-server.sh` - 자동 서버 실행 스크립트

#### Mock 데이터 특징
- **실제 데이터와 동일한 구조**: Firebase 데이터베이스와 호환되는 형식
- **완전한 기능 시뮬레이션**: 로그인, 공지사항, 과목별/연도별 문제 등
- **테마 전환 기능**: 다크/라이트 모드 완벽 지원
- **반응형 디자인**: 모든 화면 크기에서 최적화

### 🎨 개발용 홈페이지 기능

#### 주요 기능들
1. **테마 전환**: 다크/라이트 모드 실시간 전환
2. **Mock 로그인**: 실제 데이터베이스 없이 로그인 시뮬레이션
3. **공지사항**: Mock 데이터로 실제와 동일한 공지사항 표시
4. **과목별 문제**: 8개 과목의 카드형 레이아웃
5. **연도별 문제**: 2019~2025년 기출문제 목록
6. **모의고사**: 연도별 모의고사 정보
7. **반응형 디자인**: 모바일/태블릿/데스크톱 최적화

#### Mock 로그인 기능
- "Mock 로그인" 버튼으로 테스트 사용자로 로그인
- 로그인 후 제한된 콘텐츠 접근 가능
- 로그아웃 기능으로 상태 초기화

### 🔧 개발 도구

#### 브라우저 개발자 도구 활용
```javascript
// 콘솔에서 Mock 데이터 확인
console.log(window.mockData);

// Mock API 테스트
window.mockAPI.getNotices().then(notices => console.log(notices));

// 테마 매니저 디버그
const manager = getThemeManager();
console.log(manager.debug());
```

#### 디버깅 정보
- 개발용 배너로 현재 상태 표시
- 콘솔에서 상세한 로그 정보 확인
- Mock 데이터 구조 및 API 함수들 접근 가능

### 🚀 배포 전 체크리스트

#### 테마 시스템 테스트
- [ ] 라이트/다크 모드 전환 확인
- [ ] 모든 컴포넌트 색상 변경 확인
- [ ] 인디케이터 색상 테마 반응 확인
- [ ] 애니메이션 및 전환 효과 확인

#### 기능 테스트
- [ ] Mock 로그인/로그아웃 기능
- [ ] 탭 전환 (공지/문제풀기/강의/학습분석)
- [ ] 서브 탭 전환 (과목별/연도별/모의고사)
- [ ] 반응형 디자인 (모바일/태블릿/데스크톱)

#### 접근성 테스트
- [ ] 키보드 네비게이션
- [ ] 고대비 모드 지원
- [ ] 모션 감소 설정 지원
- [ ] 스크린 리더 호환성

### 🎉 완료!

이제 데이터베이스 연결 없이도 완전한 홈페이지를 체험할 수 있습니다!

#### 다음 단계
1. 개발용 홈페이지에서 모든 기능 테스트
2. 테마 전환 및 디자인 확인
3. 만족하시면 실제 배포 진행

---

**Mock 데이터 시스템**으로 완전한 개발 환경을 구축했습니다! 🎭✨
