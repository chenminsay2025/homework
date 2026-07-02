param(
    [int]$Port = 8002
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-Tree([int]$ProcId) {
    if ($ProcId -le 0) { return }
    $alive = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
    if (-not $alive) { return }
    Write-Host "Killing PID $ProcId"
    taskkill /F /T /PID $ProcId | Out-Null
}

# 1) 按端口杀监听进程（含 uvicorn --reload 子进程）
for ($try = 1; $try -le 3; $try++) {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -gt 0 }
    if (-not $pids) { break }
    foreach ($procId in $pids) { Stop-Tree $procId }
    Start-Sleep -Seconds 1
}

# 2) 清理本项目 uvicorn / reload 遗留的 python 子进程（Windows 上 parent 已死时 netstat 仍显示旧 PID）
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object {
        $cmd = $_.CommandLine
        $cmd -and (
            $cmd -like '*app.main:app*' -or
            $cmd -like '*uvicorn*homework*' -or
            ($cmd -like '*multiprocessing.spawn*' -and $cmd -like '*spawn_main*')
        )
    } |
    ForEach-Object { Stop-Tree $_.ProcessId }

Start-Sleep -Seconds 1
exit 0
