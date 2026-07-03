# Show SSH public keys for GitHub: https://github.com/settings/keys
param()

$keys = @(
    @{ Path = "$env:USERPROFILE\.ssh\github_cat11.pub"; Label = "github_cat11" },
    @{ Path = "$env:USERPROFILE\.ssh\id_ed25519.pub"; Label = "id_ed25519" }
)

Write-Host ""
Write-Host "=== GitHub SSH Public Keys ===" -ForegroundColor Cyan
Write-Host "Add at: https://github.com/settings/keys" -ForegroundColor Yellow
Write-Host ""

$found = $false
foreach ($k in $keys) {
    if (Test-Path $k.Path) {
        $found = $true
        Write-Host "--- $($k.Label) ---" -ForegroundColor Green
        Get-Content $k.Path
        Write-Host ""
    }
}

if (-not $found) {
    Write-Host "No SSH public key found." -ForegroundColor Red
    exit 1
}

Write-Host "After adding key, test: ssh -T git@github.com" -ForegroundColor Cyan
Write-Host "Push code: .\scripts\git-push.ps1 -Message 'your message'" -ForegroundColor Cyan
Write-Host ""

foreach ($k in $keys) {
    if (Test-Path $k.Path) {
        $pub = Get-Content $k.Path -Raw
        Set-Clipboard -Value $pub -ErrorAction SilentlyContinue
        if ($?) {
            Write-Host "[OK] Copied $($k.Label) to clipboard" -ForegroundColor Green
        }
        break
    }
}
