@echo off
REM Polarad - 네이버 광고 예산 알림 자동 실행
REM Windows 작업 스케줄러에서 매일 오전 9시에 실행

cd /d F:\polarad-meta\scripts
node naver-budget-alert.js

echo.
echo 실행 완료: %date% %time%
