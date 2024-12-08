@echo off

rd /s /q dist 

call ./node_modules/.bin/tsc
call build.bat
call update_vers.bat

for /f %%i in ('jq -r .version dist/release/manifest.json') do set VERS=%%i
set E=qnote-%VERS%.zip

if exist %E% (
	echo %E% exists, removing
	del %E%
	rem file exists
)

"C:\Program Files\7-Zip\7z.exe" a %E% .\dist\release\* > nul

if errorlevel 1 (
	echo 7z failure %errorlevel%
	exit /b %errorlevel%
) else (
	echo %E% created
)
