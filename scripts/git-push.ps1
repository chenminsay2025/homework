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

function Test-ClashProxy {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 7890)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Invoke-GitWithProxyFallback {
    param([string[]]$GitArgs)
    $useProxy = Test-ClashProxy
    if ($useProxy) {
        git @GitArgs
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    git -c http.proxy= -c https.proxy= @GitArgs
    return ($LASTEXITCODE -eq 0)
}

Write-Host "[git-push] fetching origin main..." -ForegroundColor Cyan
if (-not (Invoke-GitWithProxyFallback @("fetch", "origin", "main"))) {
    Write-Host "[git-push] fetch failed." -ForegroundColor Red
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
if (-not (Invoke-GitWithProxyFallback @("push", "origin", "main"))) {
    Write-Host "[git-push] push failed." -ForegroundColor Red
    exit 1
}

Write-Host "[git-push] done. Baota will deploy in 1-3 minutes." -ForegroundColor Green
