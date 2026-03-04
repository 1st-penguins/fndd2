@echo off
cd /d "%~dp0"
echo 서버 시작 중...
start cmd /k "python -m http.server 8000"
timeout /t 3 /nobreak >nul
start http://localhost:8000
echo.
echo 서버가 시작되었습니다!
echo 브라우저에서 http://localhost:8000 을 확인하세요.
pause

