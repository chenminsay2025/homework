# 构建 Android APK（Capacitor）
# 用法：
#   .\scripts\build-apk.ps1
#   .\scripts\build-apk.ps1 -ApiBase "https://homework.meituyin.cn/api"
#   .\scripts\build-apk.ps1 -OpenStudio   # 只同步并在 Android Studio 里打包
param(
    [string]$ApiBase = "",
    [switch]$OpenStudio,
    [switch]$Release
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Frontend = Join-Path $Root "frontend"
Set-Location $Frontend

# 读取 API 地址
if (-not $ApiBase) {
    $mobileEnv = Join-Path $Frontend ".env.mobile"
    if (Test-Path $mobileEnv) {
        Get-Content $mobileEnv | ForEach-Object {
            if ($_ -match '^VITE_API_BASE_URL=(.+)$') { $ApiBase = $matches[1].Trim() }
        }
    }
}
if (-not $ApiBase) {
    $ApiBase = "https://homework.meituyin.cn/api"
}

Write-Host "[build-apk] API: $ApiBase" -ForegroundColor Cyan

Write-Host "[build-apk] npm install..." -ForegroundColor Cyan
npm install --registry=https://registry.npmmirror.com
if ($LASTEXITCODE -ne 0) { exit 1 }

$env:VITE_API_BASE_URL = $ApiBase
$env:VITE_APP_BASE = "./"
Write-Host "[build-apk] build frontend..." -ForegroundColor Cyan
npm run build:mobile
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not (Test-Path "android")) {
    Write-Host "[build-apk] cap add android (first time)..." -ForegroundColor Cyan
    npx cap add android
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "[build-apk] cap sync android..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit 1 }

if ($OpenStudio) {
    Write-Host "[build-apk] open Android Studio..." -ForegroundColor Cyan
    npx cap open android
    exit 0
}

$gradlew = Join-Path $Frontend "android\gradlew.bat"
if (-not (Test-Path $gradlew)) {
    Write-Host "[build-apk] 未找到 gradlew。请安装 Android Studio，然后运行:" -ForegroundColor Yellow
    Write-Host "  .\scripts\build-apk.ps1 -OpenStudio" -ForegroundColor Yellow
    exit 1
}

$task = if ($Release) { "assembleRelease" } else { "assembleDebug" }
Write-Host "[build-apk] gradle $task ..." -ForegroundColor Cyan
Push-Location (Join-Path $Frontend "android")
& .\gradlew.bat $task
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) {
    Write-Host "[build-apk] Gradle 失败。需 JDK 17+ 与 Android SDK。" -ForegroundColor Red
    Write-Host "  安装 Android Studio 后运行: .\scripts\build-apk.ps1 -OpenStudio" -ForegroundColor Yellow
    exit 1
}

$outDir = if ($Release) { "release" } else { "debug" }
$apkName = if ($Release) { "app-release-unsigned.apk" } else { "app-debug.apk" }
$apkPath = Join-Path $Frontend "android\app\build\outputs\apk\$outDir\$apkName"
$destDir = Join-Path $Root "deploy"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir ("homework-" + (Get-Date -Format "yyyyMMdd-HHmm") + "-" + $outDir + ".apk")
Copy-Item $apkPath $dest -Force
Write-Host "[build-apk] 完成: $dest" -ForegroundColor Green
