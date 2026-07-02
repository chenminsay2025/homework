param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-Tree([int]$ProcId) {
    if ($ProcId -le 0) { return }
    if (-not (Get-Process -Id $ProcId -ErrorAction SilentlyContinue)) { return }
    Write-Host "Killing PID $ProcId on port $Port"
    taskkill /F /T /PID $ProcId | Out-Null
}

for ($try = 1; $try -le 5; $try++) {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -gt 0 }
    if (-not $pids) { exit 0 }
    foreach ($procId in $pids) { Stop-Tree $procId }
    Start-Sleep -Seconds 1
}
exit 0
