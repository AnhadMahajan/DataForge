@echo off
title DataForge Python Backend Server
echo ===================================================
echo Starting DataForge Native Python Backend (FastAPI)
echo ===================================================
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause
