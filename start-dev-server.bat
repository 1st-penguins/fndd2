@echo off
echo 🚀 퍼스트펭귄 개발 서버 시작 중...
echo.
echo 📁 현재 디렉토리: %CD%
echo 🌐 서버 주소: http://localhost:8000
echo 🎭 개발용 홈페이지: http://localhost:8000/index-dev.html
echo 🧪 테마 테스트: http://localhost:8000/theme-test.html
echo.
echo 💡 브라우저에서 위 주소들을 확인해보세요!
echo 💡 서버를 중지하려면 Ctrl+C를 누르세요.
echo.

REM Python 3 확인
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Python 3을 사용하여 서버를 시작합니다...
    python -m http.server 8000
    goto end
)

REM Python 2 확인
python2 --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Python 2를 사용하여 서버를 시작합니다...
    python2 -m SimpleHTTPServer 8000
    goto end
)

REM Node.js 확인
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Node.js를 사용하여 서버를 시작합니다...
    npx serve . -p 8000
    goto end
)

echo ❌ Python 또는 Node.js가 설치되어 있지 않습니다.
echo.
echo 📥 설치 방법:
echo    Python: https://www.python.org/downloads/
echo    Node.js: https://nodejs.org/
echo.
echo 🔧 또는 VS Code의 Live Server 확장을 사용하세요.

:end
pause
