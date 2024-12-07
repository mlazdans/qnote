@echo off

for /f %%i in ('jq -r .version dist/release/manifest.json') do set VERS=%%i
C:\cygwin64\bin\grep.exe -iEHlr "\?version=version" dist/release | xargs C:\cygwin64\bin\sed.exe -i "s/?version=version/?version=%VERS%/g"
