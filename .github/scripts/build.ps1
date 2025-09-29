param(
  [string]$Target = $env:TARGET,
  [string]$Workspace = $env:GITHUB_WORKSPACE
)

if (-not $Workspace) { $Workspace = (Get-Location).Path }

if (-not $Target) {
  Write-Error "Usage: build.ps1 -Target <target> [-Workspace <path>]"
  exit 2
}

Write-Host "Building target=$Target workspace=$Workspace"

$scriptRoot = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
$manifestPath = Join-Path $repoRoot 'backend\Cargo.toml'

# Build
& cargo build --release --target $Target --manifest-path $manifestPath

$srcBin = Join-Path $repoRoot ("backend\target\$Target\release\backend.exe")

if (-not (Test-Path $srcBin)) {
  Write-Error "ERROR: expected binary at $srcBin but not found"
  Get-ChildItem -Path (Split-Path $srcBin) -Force -ErrorAction SilentlyContinue
  exit 3
}

$platform = "windows"

$arch = "unknown"
if ($Target -match "x86_64|x86-64") { $arch = "x86_64" }
elseif ($Target -match "i686|i386") { $arch = "i686" }

$folderName = "folderlan-$platform-$arch"
$archiveName = "$folderName.zip"
$targetFolder = Join-Path $Workspace $folderName
if (-not (Test-Path $targetFolder)) { New-Item -ItemType Directory -Path $targetFolder | Out-Null }

# Destination filename
$destName = "Folderlan.exe"
Copy-Item -Path $srcBin -Destination (Join-Path $targetFolder $destName) -Force

# Create zip
Push-Location $Workspace
try {
  if (Get-Command -Name "zip" -ErrorAction SilentlyContinue) {
    & zip -r $archiveName $folderName
  } else {
    # PowerShell native
    if (Get-Command -Name "Compress-Archive" -ErrorAction SilentlyContinue) {
      if (Test-Path $archiveName) { Remove-Item $archiveName -Force }
      Compress-Archive -Path $folderName -DestinationPath $archiveName
    } else {
      Write-Error "No zip tool available on runner"
      exit 4
    }
  }
}
finally {
  Pop-Location
}

Write-Host "Created archive at: $Workspace\$archiveName"

# Export output via GITHUB_OUTPUT env file (so the workflow step gets the output)
if ($env:GITHUB_OUTPUT) {
  Add-Content -Path $env:GITHUB_OUTPUT -Value "archive_name=$archiveName"
} else {
  Write-Host "archive_name=$archiveName"
}
