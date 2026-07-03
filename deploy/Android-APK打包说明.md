# Android APK 打包说明

将前端打包为 Android APK，通过 **Capacitor** 嵌入 WebView，连接线上服务器 API。

> APK 内不含后端，需服务器已部署（如 `https://homework.meituyin.cn`）。

---

## 一、环境准备（首次）

1. **Node.js 18+**（已有）
2. **Android Studio**（含 Android SDK）
   - 下载：https://developer.android.com/studio
   - 安装时勾选 Android SDK、SDK Platform（API 34+）
3. **JDK 17+**（Android Studio 自带，或单独安装）
   - Capacitor 7 / Gradle 8 需要 JDK 17，**Java 8 不够**
4. 环境变量（可选，命令行打包时需要）：
   - `ANDROID_HOME` → 如 `C:\Users\你\AppData\Local\Android\Sdk`
   - 将 `%ANDROID_HOME%\platform-tools` 加入 PATH

---

## 二、配置 API 地址

```bat
copy frontend\.env.mobile.example frontend\.env.mobile
```

编辑 `frontend\.env.mobile`：

```env
VITE_API_BASE_URL=https://homework.meituyin.cn/api
```

改成你的生产域名（必须 HTTPS）。

服务器 `.env` 中 `CORS_ORIGINS=*` 时可正常访问；若限制了域名，需加上 Capacitor 来源或保持 `*`。

---

## 三、一键打包

```bat
scripts\build-apk.bat
```

或指定 API：

```powershell
.\scripts\build-apk.ps1 -ApiBase "https://homework.meituyin.cn/api"
```

**首次 / Gradle 报错时**，用 Android Studio 打包：

```bat
scripts\build-apk.bat -OpenStudio
```

在 Android Studio：**Build → Build Bundle(s) / APK(s) → Build APK(s)**

---

## 四、输出位置

| 方式 | 路径 |
|------|------|
| 脚本自动复制 | `deploy\homework-日期时间-debug.apk` |
| Gradle 原始输出 | `frontend\android\app\build\outputs\apk\debug\app-debug.apk` |

正式版（需签名）：

```powershell
.\scripts\build-apk.ps1 -Release -OpenStudio
```

在 Android Studio 配置 **Signing Config** 后 Build → Generate Signed Bundle / APK。

---

## 五、日常更新 APK 流程

```bat
cd frontend
npm run build:mobile
npx cap sync android
```

然后在 Android Studio 重新 Build APK，或：

```bat
scripts\build-apk.bat
```

---

## 六、常见问题

| 现象 | 处理 |
|------|------|
| Gradle 报 JDK 版本 | 安装 JDK 17，Android Studio → Settings → Gradle JDK 选 17 |
| 找不到 ANDROID_HOME | 安装 Android Studio，或 `-OpenStudio` 用 IDE 打包 |
| APK 打开白屏 | 检查 `.env.mobile` 域名是否正确、服务器是否 HTTPS 可访问 |
| 登录失败 / 网络错误 | 手机需能访问服务器；检查 API 地址末尾为 `/api` |
| 附件预览失败 | 确认服务器附件 URL 为 HTTPS |

---

## 七、相关文件

| 文件 | 说明 |
|------|------|
| `frontend/capacitor.config.ts` | App ID、名称 |
| `frontend/.env.mobile` | APK 用的 API 地址（不提交 Git） |
| `frontend/android/` | Android 工程（`cap add android` 后生成） |
| `scripts/build-apk.ps1` | 一键构建脚本 |

应用 ID：`cn.meituyin.homework`  
应用名：**作业计划表**
