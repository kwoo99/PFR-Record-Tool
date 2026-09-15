[CmdletBinding()]
param(
  [string]$PublisherName = "Kyle Woo",
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\..\certificates")
)

$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  throw "This certificate must be created on Windows."
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

$password = Read-Host "Choose a password for the private PFX file" -AsSecureString
$certificate = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=$PublisherName" `
  -FriendlyName "PFR Record Tool Internal Publisher" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(3)

$pfxPath = Join-Path $resolvedOutput "PFRRecordTool-Internal.pfx"
$cerPath = Join-Path $resolvedOutput "PFRRecordTool-Internal.cer"

Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $password | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null

Write-Host "Created internal publisher certificate:"
Write-Host "  Private signing key: $pfxPath"
Write-Host "  Public trust certificate: $cerPath"
Write-Host "Keep the PFX private. Install only the CER on each approved Windows computer."
