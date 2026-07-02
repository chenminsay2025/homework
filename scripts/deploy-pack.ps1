# 打包可上传服务器的部署包（不含 node_modules、.env 等）
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $Root "deploy"
$Date = Get-Date -Format "yyyyMMdd-HHmm"
$Zip = Join-Path $OutDir "homework-deploy-$Date.zip"
$Stage = Join-Path $env:TEMP "homework-deploy-$Date"

if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
if (Test-Path -LiteralPath $Stage) {
    Remove-Item -LiteralPath $Stage -Recurse -Force
}
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

Write-Host "正在打包部署包..."
Write-Host "输出: $Zip"

$robocopyArgs = @(
    $Root,
    $Stage,
    "/E",
    "/XD", "node_modules", "dist", ".git", "__pycache__", ".venv", "venv", ".cursor", "deploy",
    "/XF", ".env", "tsconfig.tsbuildinfo", "backend.log", "homework-deploy-*.zip",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP"
)
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -gt 7) {
    Write-Host "复制失败 (robocopy $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

# 确保 deploy 模板与脚本在包内
$deploySrc = Join-Path $Root "deploy"
if (Test-Path -LiteralPath $deploySrc) {
    Copy-Item -Path $deploySrc -Destination (Join-Path $Stage "deploy") -Recurse -Force
}

if (Test-Path -LiteralPath $Zip) {
    Remove-Item -LiteralPath $Zip -Force
}

Push-Location -LiteralPath $Stage
try {
    & tar -a -cf $Zip .
    if ($LASTEXITCODE -ne 0) { throw "tar exit $LASTEXITCODE" }
    $size = (Get-Item -LiteralPath $Zip).Length
    Write-Host ""
    Write-Host "完成: $Zip"
    Write-Host "大小: $size 字节"
    Write-Host ""
    Write-Host "上传后解压，在服务器执行:"
    Write-Host "  bash scripts/install.sh"
}
catch {
    Write-Host "打包失败: $_" -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
    Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue
}
