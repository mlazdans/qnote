@echo off

xcopy /S /D /Y src\_locales\        dist\release\_locales\
xcopy /S /D /Y src\html\            dist\release\html\
xcopy /S /D /Y src\images\          dist\release\images\
xcopy /S /D /Y src\schemas\         dist\release\schemas\
xcopy /D /Y src\manifest.json       dist\release\
xcopy /D /Y src\background.html     dist\release\

@REM ./node_modules/.bin/webpack
