@echo off
title DataForge Express & MongoDB Backend Server
echo ===================================================
echo Starting DataForge Express.js & MongoDB MVC Backend
echo Port: 5000 | Health: http://localhost:5000/api/health
echo ===================================================
cd /d "%~dp0"
npm run backend
pause

