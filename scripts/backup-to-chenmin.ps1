# Backup project to X:\设计记录\陈敏 (exclude large dirs)
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Dest = "X:\设计记录\陈敏"
$Date = Get-Date -Format "yyyyMMdd"
$Zip = Join-Path $Dest "homework-backup-$Date.zip"
$DbPath = Join-Path $Root "backend\homework.db"
$Stage = Join-Path $env:TEMP "homework-backup-$Date"

if (-not (Test-Path -LiteralPath $Dest)) {
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
}
if (Test-Path -LiteralPath $Zip) {
    Remove-Item -LiteralPath $Zip -Force
}
if (Test-Path -LiteralPath $Stage) {
    Remove-Item -LiteralPath $Stage -Recurse -Force
}
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

Write-Host "正在打包到 $Zip ..."
Write-Host "排除 node_modules、dist、.git 等大目录，保留源码与文档。"

$robocopyArgs = @(
    $Root,
    $Stage,
    "/E",
    "/XD", "node_modules", "dist", ".git", "__pycache__", ".venv", "venv", ".cursor",
    "/XF", ".env", "tsconfig.tsbuildinfo", "backend.log",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP"
)
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -gt 7) {
    Write-Host ""
    Write-Host "复制文件失败 (robocopy $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

if (Test-Path -LiteralPath $DbPath) {
    try {
        $stageDb = Join-Path $Stage "backend\homework.db"
        New-Item -ItemType Directory -Path (Split-Path $stageDb) -Force | Out-Null
        Copy-Item -LiteralPath $DbPath -Destination $stageDb -Force
        Write-Host "已包含数据库 backend\homework.db"
    } catch {
        Write-Host ""
        Write-Host "错误: 无法读取 backend\homework.db（可能被后端独占占用）。" -ForegroundColor Red
        Write-Host "请先关闭后端窗口，或运行 scripts\kill-backend.bat 后再执行本脚本。" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "提示: 未找到 backend\homework.db"
}

Push-Location -LiteralPath $Stage
try {
    & tar -a -cf $Zip .
    if ($LASTEXITCODE -ne 0) {
        throw "tar exit code $LASTEXITCODE"
    }

    $size = (Get-Item -LiteralPath $Zip).Length
    Write-Host ""
    Write-Host "完成: $Zip"
    Write-Host "大小: $size 字节"
}
catch {
    Write-Host ""
    Write-Host "打包失败: $_" -ForegroundColor Red
    Write-Host "请确认 tar 可用（Windows 10+ 自带），且目标盘 X: 可写。" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
    if (Test-Path -LiteralPath $Stage) {
        Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}