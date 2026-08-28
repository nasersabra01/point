@echo off
title برنامج المحاسبة

cd /d "F:\NODE.JS\Projects\profits_calc - Copy"

start "" cmd /k "npm start"

timeout /t 3 /nobreak >nul

start http://localhost:3001

exit