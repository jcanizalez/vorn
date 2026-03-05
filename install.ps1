$ErrorActionPreference = "Stop"

$Repo = "jcanizalez/vibegrid"
$AppName = "VibeGrid"

function Get-LatestVersion {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    return $release.tag_name
}

$Version = if ($env:VIBEGRID_VERSION) { $env:VIBEGRID_VERSION } else { Get-LatestVersion }

if (-not $Version) {
    Write-Error "Could not determine latest version. Set VIBEGRID_VERSION=vX.Y.Z to install a specific version."
    exit 1
}

$VersionNum = $Version.TrimStart("v")

Write-Host "Installing $AppName $Version..."

$Artifact = "$AppName-Setup-$VersionNum.exe"
$Url = "https://github.com/$Repo/releases/download/$Version/$Artifact"
$TempDir = Join-Path $env:TEMP "vibegrid-install"
$InstallerPath = Join-Path $TempDir $Artifact

New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Write-Host "Downloading $Artifact..."
Invoke-WebRequest -Uri $Url -OutFile $InstallerPath -UseBasicParsing

Write-Host "Running installer..."
Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait

Write-Host "Cleaning up..."
Remove-Item -Recurse -Force $TempDir

Write-Host "$AppName $Version installed!"
Write-Host "Done!"
