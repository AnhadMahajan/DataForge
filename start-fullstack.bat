@echo off
title DataForge Fullstack Platform (Backend + Frontend)
echo ===================================================
echo Starting DataForge Fullstack System
echo Backend:  http://localhost:5000 (Express & MongoDB)
echo Frontend: http://localhost:3005 (Web Application)
echo Health:   http://localhost:5000/api/health
echo ===================================================
cd /d "%~dp0"
npm run fullstack
pause
