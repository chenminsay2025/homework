# Push to GitHub main (triggers Baota webhook auto-deploy)
# Usage:
#   .\scripts\git-push.ps1
#   .\scripts\git-push.ps1 -Message "fix: something"
param(
    [string]$Message
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "[git-push] fetching origin main..." -ForegroundColor Cyan
git fetch origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[git-push] fetch failed. Check Clash proxy on 127.0.0.1:7890" -ForegroundColor Red
    exit 1
}

if ($Message) {
    git add -A
    $status = git status --porcelain
    if ($status) {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        Write-Host "[git-push] no changes, skip commit" -ForegroundColor Yellow
    }
}

Write-Host "[git-push] pushing to origin main..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[git-push] push failed. Run .\scripts\show-github-ssh-key.ps1" -ForegroundColor Red
    Write-Host "Add SSH key at https://github.com/settings/keys then retry." -ForegroundColor Yellow
    exit 1
}

Write-Host "[git-push] done. Baota will deploy in 1-3 minutes." -ForegroundColor Green
