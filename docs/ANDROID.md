# 安卓首个离线测试版

更新：2026-11-12。基线为 m0 `123ab62`，版本 1.0.0（1），应用标识 `dev.weiguang.comic`。这是 Debug 签名的测试 APK，尚未提交应用商店。

## 本轮实现

- 注册 `ComicImport`、`ComicArchive`、`ComicReader` 三个 Capacitor 原生插件。通过系统文件选择器取得临时来源标识，流式复制到私有 `no_backup/ComicLibrary`；支持多选、自然排序、进度、取消、失败清理和重复导入识别。网页不能提供任意外部路径，也不修改原文件。
- ZIP/CBZ：自行读取 ZIP/ZIP64 中央目录，保留原始文件名字节及全部条目索引，支持 stored/deflate、CRC 校验、加密和符号链接识别。包内文件名不参与输出路径生成。
- PDF：使用 Android `PdfRenderer` 读取和渲染；图片 EPUB 的元数据在原生层限量读取，由现有网页逻辑解析图片顺序、右翻和文字书/受保护文件拒绝规则。
- 页面在原生层解压并降采样，只向 WebView 返回缩小图缓存地址。单图解压上限 256 MiB，输出不超过 400 万像素；JPEG EXIF 方向生效。页面缓存按最近使用淘汰，上限 500 MiB，可清理并重建。
- 复用书架、系列、分组、书签、进度、单页/双页/条漫和阅读设置。安卓返回键按弹窗、阅读器、系列、书架处理，退出阅读先保存进度；支持全屏与常亮，后台释放常亮。
- 关闭系统备份，移除 INTERNET 权限；应用内展示安卓专用中英隐私政策。使用正式图标启动主题。过旧的 Chromium WebView（低于 94）显示内置更新提示。
- 未新增依赖或原生库，新增第三方原生库的安装包增量为 0。成品 APK 大小见交付目录，不能据此推算相对旧版的增量。

## 实际验证

| 检查                 | 结果与范围                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm build:android` | 类型检查、生产构建、原生同步通过                                                                                                                                                                                   |
| `pnpm test`          | 31 文件，233/233 通过，覆盖复用的网页纯逻辑                                                                                                                                                                        |
| JVM 原生测试         | 15/15 通过，其中 14 项为本轮新增；覆盖 ZIP64、旧编码、损坏/加密/链接、CRC、目录边界、取消、来源路径、自然排序、指纹与尺寸限制                                                                                      |
| Android 原生运行测试 | API 24 x86_64 隔离模拟器，5/5 通过；真实 BitmapFactory/PdfRenderer 验证 ZIP、EPUB、PDF、缓存重建、坏页拒绝、EXIF 方向、原文件指纹不变                                                                              |
| APK 检查             | v2 签名验证通过；minSdk 24、targetSdk 36、1.0.0（1）；无 INTERNET 或存储读取权限，仅依赖引入的应用内部接收器权限                                                                                                   |
| 旧 WebView 启动      | API 24 原厂旧组件实际显示更新说明；截图 `release/android-webview-compatibility.png`                                                                                                                                |
| 格式与静态检查       | 全量 ESLint 通过；本轮修改的 TS/TSX/HTML 文件单独检查通过。`pnpm lint` 整体未通过：Windows CRLF 与默认 LF 不一致，以及新入库官网已有格式问题；使用 `--end-of-line auto` 后仍有官网文件提示。本轮未批量改写无关文件 |

未完成：完整安卓交互验收、系统文件选择器到书架的端到端点检、真机、各厂商/云盘文件提供方、大文件性能、旋转与后台完整回归、正式发行签名与上架。官方 API 35/36 镜像下载未成功完成，已停止本轮下载任务；不能把原生运行测试记作完整界面验收。用户选择自行安装 APK 测试，本轮未在连接的个人手机上安装或操作。

## 安装后优先检查

1. 导入自己的一份 ZIP/CBZ、PDF 和图片 EPUB，核对封面、页数、排序；再导入同一文件，确认不重复入库。
2. 打开阅读，分别试单页、双页、条漫和左右翻。读到中间，返回书架并重新打开，再关闭重开 App，确认位置保留。
3. 打开目录、阅读设置或隐私政策，按手机返回键，确认先关闭当前弹窗；阅读中返回书架时不丢进度。
4. 试全屏、亮暗主题和后台再回来；在设置清理缓存后重新打开漫画，确认页面重新生成。
5. 删除一本导入副本，确认系统文件管理器中的原文件仍在；取消大文件导入、尝试坏包和纯文字 EPUB，确认有提示且不留下书架条目。

## 构建与原生测试

先执行 `pnpm build:android`，再在 `android/` 运行：

```sh
./gradlew :app:clean :app:assembleDebug :app:assembleDebugAndroidTest :app:testDebugUnitTest
```

JDK 21、Android SDK 36。本机 Windows 中文路径下，测试工作进程的参数文件编码曾导致 `GradleWorkerMain` 无法加载，本轮使用 `-Dorg.gradle.jvmargs="-Xmx1536m -Dfile.encoding=GBK"` 解决；Java 源文件编译明确使用 UTF-8。还发现增量 DEX 没有包含最新 class，已核对 APK 内字节码并执行 `:app:clean` 重建，交付包取自这次完整重建。不要把此编码选项强加给其他系统。

运行设备测试时必须明确指定测试设备，避免在连接的个人手机上执行：

```sh
adb -s <test-emulator-serial> install -r app/build/outputs/apk/debug/app-debug.apk
adb -s <test-emulator-serial> install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s <test-emulator-serial> shell am instrument -w -e class dev.weiguang.comic.ComicStoreTest dev.weiguang.comic.test/androidx.test.runner.AndroidJUnitRunner
```

## 后续范围

Android 尚无购买权益提供方，默认不可购买 Pro。裁边、应用锁、原位阅读等付费功能不作为本轮交付；不模拟已购买，不把既有免费功能改为收费。下一轮先依据用户真机反馈修复主流程，再确定安卓发行渠道与一次买断方案。RAR/CBR、图片文件夹导入仍未实现。

APK、测试日志、截图和 SDK 临时文件均留在已忽略的 `release/`，签名材料不入库。用户已授权将本轮安卓代码、测试与检查点提交并推送到 m0，真机测试由用户自行安装 APK 完成。

## 待办：官网下载用的正式签名 APK（2026-11-12 用户决定）

官网 comic.spineapps.com 首页已加「下载安卓测试版」按钮，链接 `/download/lumicomic-1.0.0-android.apk`。用户选择**只发正式签名包**：Debug 包换签名后无法覆盖安装，用户只能卸载重装，而安卓版关闭了备份，卸载会清空书架。所以官网在拿到正式签名包之前不部署。

在 Windows 构建机上完成：

1. 生成发行密钥（只做一次）：`keytool -genkeypair -v -keystore lumicomic-release.jks -alias lumicomic -keyalg RSA -keysize 4096 -validity 36500`。密钥文件和密码放在仓库外，并另做离线备份；**丢了就再也不能给已安装的用户发更新**。`*.jks`、`android/keystore.properties` 已在 `.gitignore`。
2. `android/keystore.properties` 写 `storeFile`、`storePassword`、`keyAlias`、`keyPassword`；在 `android/app/build.gradle` 加 `signingConfigs.release`，读取该文件（文件不存在时跳过，保证没有密钥的机器仍能构建 Debug），并让 `buildTypes.release` 使用它。这部分 Gradle 改动可以入库，密钥和属性文件不入库。
3. `pnpm build:android`，然后在 `android/` 运行 `./gradlew :app:clean :app:assembleRelease`。
4. 用 `apksigner verify --print-certs` 确认 v2 签名、证书不是 Android Debug；核对包名 `dev.weiguang.comic`、版本 1.0.0（1）、无 INTERNET 权限。记录证书 SHA-256。
5. 在真机或模拟器上安装一次并打开，确认能启动、能导入。
6. 重命名为 `LumiComic-1.0.0-android.apk`，上传到 GitHub 仓库的 Release（建议标签 `android-v1.0.0`，标为 Pre-release）。

之后在 Mac 上：把 APK 放到 `release/android/LumiComic-1.0.0-android.apk`，运行 `python3 website/build.py`（会复制到已忽略的 `website/public/download/`，并在按钮上显示文件大小），再部署官网。
