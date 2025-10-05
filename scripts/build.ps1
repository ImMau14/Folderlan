param(
    [switch]$Release
)

# Resolve script directory and repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRootPath = Join-Path $scriptDir ".."
$repoRoot = (Resolve-Path $repoRootPath).Path

try {
    # Move to repo root
    Set-Location $repoRoot

    # Check dependencies
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "pnpm is not installed."
        exit 1
    }
    if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
        Write-Host "Rust is not installed."
        exit 1
    }

    $buildMode = ""
    if ($Release) { $buildMode = "--release" }

    # Frontend: install & build
    if (-not (Test-Path "./frontend")) {
        Write-Host "frontend directory not found at $repoRoot\frontend"
        exit 1
    }
    Set-Location "./frontend"
    Write-Host "Running pnpm install in frontend..."
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "pnpm install failed."
        exit $LASTEXITCODE
    }

    Write-Host "Building frontend..."
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "pnpm build failed."
        exit $LASTEXITCODE
    }
    Set-Location $repoRoot

    # Replace backend\dist with frontend\dist
    if (-not (Test-Path "./backend")) {
        Write-Host "backend directory not found at $repoRoot\backend"
        exit 1
    }
    $dest = Join-Path (Join-Path $repoRoot "backend") "dist"
    if (Test-Path $dest) {
        Write-Host "Removing existing backend\dist..."
        Remove-Item -Recurse -Force -Path $dest
    }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Write-Host "Copying frontend\dist to backend\dist..."
    Copy-Item -Recurse -Force -Path ".\frontend\dist\*" -Destination $dest

    # Backend: build
    Set-Location "./backend"
    Write-Host "Building backend with cargo $buildMode..."
    cargo build $buildMode
    if ($LASTEXITCODE -ne 0) {
        Write-Host "cargo build failed."
        exit $LASTEXITCODE
    }

    Write-Host "Build completed successfully."
}
finally {
    # Ensure we always return to repo root
    try {
        Set-Location $repoRoot
    } catch {
        # ignore
    }
}
