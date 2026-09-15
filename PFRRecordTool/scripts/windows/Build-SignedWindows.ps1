[CmdletBinding()]
param(
  [string]$CertificateFile = (Join-Path $PSScriptRoot "..\..\certificates\PFRRecordTool-Internal.pfx")
)

$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  throw "Signed Windows installers must be built on Windows."
}

$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$resolvedCertificate = (Resolve-Path $CertificateFile).Path
$securePassword = Read-Host "Enter the PFX password" -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new(
  "certificate",
  $securePassword
)

$env:PFR_WINDOWS_CERTIFICATE_FILE = $resolvedCertificate
$env:PFR_WINDOWS_CERTIFICATE_PASSWORD = $credential.GetNetworkCredential().Password

try {
  Push-Location $projectDirectory
  & npm.cmd run make:windows
  if ($LASTEXITCODE -ne 0) {
    throw "The signed Windows build failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
  Remove-Item Env:\PFR_WINDOWS_CERTIFICATE_FILE -ErrorAction SilentlyContinue
  Remove-Item Env:\PFR_WINDOWS_CERTIFICATE_PASSWORD -ErrorAction SilentlyContinue
  $credential = $null
  $securePassword = $null
}
