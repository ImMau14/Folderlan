@echo off
setlocal enabledelayedexpansion

REM go to repo root (parent of scripts folder)
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%.."

REM check deps
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is not installed.
  popd
  exit /b 1
)
where rustc >nul 2>nul
if errorlevel 1 (
  echo Rust is not installed.
  popd
  exit /b 1
)

REM parse arg
set BUILD_MODE=
if "%~1"=="--release" set BUILD_MODE=--release

REM frontend install & build
if not exist "frontend" (
  echo frontend directory not found at "%CD%\frontend"
  popd
  exit /b 1
)
pushd "frontend"
echo Running pnpm install in frontend...
call pnpm install
if errorlevel 1 (
  echo pnpm install failed.
  popd
  popd
  exit /b 1
)

echo Building frontend...
call pnpm build
if errorlevel 1 (
  echo pnpm build failed.
  popd
  popd
  exit /b 1
)
popd

REM replace backend\dist
if not exist "backend" (
  echo backend directory not found at "%CD%\backend"
  popd
  exit /b 1
)
if exist "backend\dist" (
  echo Removing existing backend\dist...
  rmdir /S /Q "backend\dist"
)
mkdir "backend\dist"
echo Copying frontend\dist to backend\dist...
xcopy /E /I /Y "frontend\dist\*" "backend\dist\" >nul

REM backend build
pushd "backend"
echo Building backend with cargo %BUILD_MODE%...
call cargo build %BUILD_MODE%
if errorlevel 1 (
  echo cargo build failed.
  popd
  popd
  exit /b 1
)
popd

echo Build completed successfully.
popd
endlocal
