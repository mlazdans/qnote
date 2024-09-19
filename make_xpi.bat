@echo off

for /f %%i in ('jq -r .version qnote/dist/release/manifest.json') do set VERS=%%i
set E=qnote-%VERS%.xpi

if exist %E% (
	echo %E% exists, removing
	del %E%
	rem file exists
)

"C:\Program Files\7-Zip\7z.exe" a %E% .\qnote\dist\release\* > nul

if errorlevel 1 (
	echo 7z failure %errorlevel%
	exit /b %errorlevel%
) else (
	echo %E% created
)
