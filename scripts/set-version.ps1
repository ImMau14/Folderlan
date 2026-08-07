param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Version
)

# Usage: .\scripts\set-version.ps1 <x.y.z>
# Updates the app version in backend/Cargo.toml, backend/Cargo.lock and frontend/package.json.

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "Error: version must match 'major.minor.patch' (e.g. 1.2.0)" -ForegroundColor Red
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
Push-Location $repoRoot

try {
    # backend/Cargo.toml
    $cargoToml = Join-Path $repoRoot "backend\Cargo.toml"
    if (-not (Test-Path $cargoToml)) {
        Write-Host "backend\Cargo.toml not found at $repoRoot\backend" -ForegroundColor Red
        exit 1
    }
    $content = Get-Content $cargoToml -Raw
    $content = $content -replace '(?m)^version = "\d+\.\d+\.\d+"$', "version = `"$Version`""
    Set-Content $cargoToml $content -NoNewline

    # backend/Cargo.lock (root package only)
    $cargoLock = Join-Path $repoRoot "backend\Cargo.lock"
    if (Test-Path $cargoLock) {
        $lines = Get-Content $cargoLock
        for ($i = 0; $i -lt $lines.Length - 1; $i++) {
            if ($lines[$i] -eq "name = `"backend`"") {
                $lines[$i + 1] = $lines[$i + 1] -replace 'version = "\d+\.\d+\.\d+"', "version = `"$Version`""
                break
            }
        }
        Set-Content $cargoLock $lines
    }

    # frontend/package.json
    $pkgJson = Join-Path $repoRoot "frontend\package.json"
    if (-not (Test-Path $pkgJson)) {
        Write-Host "frontend\package.json not found at $repoRoot\frontend" -ForegroundColor Red
        exit 1
    }
    $pkg = Get-Content $pkgJson -Raw
    $pkg = $pkg -replace '("version":\s*)"\d+\.\d+\.\d+"', ('${1}"' + $Version + '"')
    Set-Content $pkgJson $pkg -NoNewline

    Write-Host "Version updated to $Version in backend\Cargo.toml, backend\Cargo.lock and frontend\package.json" -ForegroundColor Green
    Write-Host "Frontend displays it at build time via import.meta.env.APP_VERSION."
}
finally {
    Pop-Location
}