@echo off

xcopy /S /D /Y src\_locales\        dist\release\_locales\
@REM xcopy /S /D /Y src\api\*.js         dist\release\api\
xcopy /S /D /Y src\html\            dist\release\html\
xcopy /S /D /Y src\images\          dist\release\images\
xcopy /S /D /Y src\schemas\         dist\release\schemas\
@REM xcopy /S /D /Y src\modules\*.js     dist\release\modules\
@REM xcopy /S /D /Y src\modules\*.mjs     dist\release\modules\
@REM xcopy /S /D /Y src\modules-exp\*.js dist\release\modules-exp\
@REM xcopy /S /D /Y src\scripts\*.js     dist\release\scripts\
xcopy /D /Y src\manifest.json       dist\release\
xcopy /D /Y src\background.html     dist\release\

@REM ./node_modules/.bin/webpack
