[CmdletBinding()]
param(
  [string]$CertificatePath = (Join-Path $PSScriptRoot "..\..\certificates\PFRRecordTool-Internal.cer")
)

$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
  throw "This trust certificate can only be installed on Windows."
}

$resolvedCertificate = (Resolve-Path $CertificatePath).Path
$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
  $resolvedCertificate
)

Write-Host "Certificate subject: $($certificate.Subject)"
Write-Host "Certificate thumbprint: $($certificate.Thumbprint)"
Write-Warning "This gives the certificate authority to identify trusted software for the current Windows user."
$confirmation = Read-Host "Type TRUST to continue"

if ($confirmation -cne "TRUST") {
  throw "Certificate installation cancelled."
}

Import-Certificate `
  -FilePath $resolvedCertificate `
  -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
Import-Certificate `
  -FilePath $resolvedCertificate `
  -CertStoreLocation "Cert:\CurrentUser\TrustedPublisher" | Out-Null

Write-Host "PFR Record Tool is now trusted for the current Windows user."
