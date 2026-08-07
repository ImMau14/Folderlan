@echo off
setlocal

REM Usage: scripts\set-version.cmd <x.y.z>
if "%~1"=="" (
  echo Usage: %~nx0 ^<version^>
  echo Example: %~nx0 1.2.0
  exit /b 1
)

set NEW_VERSION=%~1

echo %NEW_VERSION% | findstr /r "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo Error: version must match "major.minor.patch" (e.g. 1.2.0)
  exit /b 1
)

REM go to repo root
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%.."

REM backend/Cargo.toml
if not exist "backend\Cargo.toml" (
  echo backend\Cargo.toml not found.
  popd
  exit /b 1
)
powershell -NoProfile -Command "(Get-Content 'backend/Cargo.toml' -Raw) -replace '(?m)^version = \"[0-9]+\.[0-9]+\.[0-9]+\"$', 'version = \"%NEW_VERSION%\"' | Set-Content 'backend/Cargo.toml' -NoNewline"

REM backend/Cargo.lock (root package only)
if exist "backend\Cargo.lock" (
  powershell -NoProfile -Command "$c = Get-Content 'backend/Cargo.lock'; for ($i = 0; $i -lt $c.Length; $i++) { if ($c[$i] -eq 'name = \"backend\"' -and $i + 1 -lt $c.Length) { $c[$i + 1] = $c[$i + 1] -replace 'version = \"[0-9]+\.[0-9]+\.[0-9]+\"', 'version = \"%NEW_VERSION%\"'; break } }; $c | Set-Content 'backend/Cargo.lock'"
)

REM frontend/package.json
if not exist "frontend\package.json" (
  echo frontend\package.json not found.
  popd
  exit /b 1
)
powershell -NoProfile -Command "(Get-Content 'frontend/package.json' -Raw) -replace '(\"version\":\s*)\"[0-9]+\.[0-9]+\.[0-9]+\"', ('${1}\"%NEW_VERSION%\"') | Set-Content 'frontend/package.json' -NoNewline"

popd
echo Version updated to %NEW_VERSION% in backend\Cargo.toml, backend\Cargo.lock and frontend\package.json