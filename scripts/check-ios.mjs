import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 复用 Capacitor CLI 自带的解析器，不引入应用依赖。
const require = createRequire(import.meta.url);
const cliRequire = createRequire(
  require.resolve('@capacitor/cli/package.json'),
);
const xcode = cliRequire('xcode');
const plist = cliRequire('plist');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const project = xcode.project(
  join(root, 'ios/App/App.xcodeproj/project.pbxproj'),
);
project.parseSync();
const objects = project.hash.project.objects;
const unquote = (value) => value?.replace(/^"|"$/g, '');
const values = (section) =>
  Object.entries(section)
    .filter(([key]) => !key.endsWith('_comment'))
    .map(([, value]) => value);
const target = values(objects.PBXNativeTarget).find(
  (entry) => entry.name === 'App',
);
assert.ok(target, 'App target 缺失');
const phaseFor = (isa) =>
  target.buildPhases.map((ref) => objects[isa]?.[ref.value]).find(Boolean);
const sourcePhase = phaseFor('PBXSourcesBuildPhase');
const sources = sourcePhase.files.map((ref) => objects.PBXBuildFile[ref.value]);
assert.ok(
  sources.some(
    (entry) =>
      unquote(objects.PBXFileReference[entry.fileRef]?.path) ===
      'ComicBridgeViewController.swift',
  ),
  '桥控制器未加入编译',
);
const products = target.packageProductDependencies.map(
  (ref) => objects.XCSwiftPackageProductDependency[ref.value],
);
assert.ok(
  products.some((entry) => entry.productName === 'ComicNative'),
  'App 没有链接 ComicNative',
);
const native = products.find((entry) => entry.productName === 'ComicNative');
assert.ok(
  phaseFor('PBXFrameworksBuildPhase').files.some(
    (ref) =>
      objects.PBXBuildFile[ref.value].productRef ===
      target.packageProductDependencies.find(
        (ref) =>
          objects.XCSwiftPackageProductDependency[ref.value].productName ===
          'ComicNative',
      ).value,
  ),
  'ComicNative 没有加入链接阶段',
);
const local = objects.XCLocalSwiftPackageReference[native.package];
assert.ok(
  existsSync(
    resolve(root, 'ios/App', unquote(local.relativePath), 'Package.swift'),
  ),
  '本地 Swift package 路径不存在',
);
const resourcePhase = phaseFor('PBXResourcesBuildPhase');
assert.ok(
  resourcePhase.files.some((ref) => {
    const buildFile = objects.PBXBuildFile[ref.value];
    return (
      unquote(objects.PBXFileReference[buildFile.fileRef]?.path) ===
      'PrivacyInfo.xcprivacy'
    );
  }),
  '隐私清单未加入资源',
);
const configs =
  objects.XCConfigurationList[target.buildConfigurationList]
    .buildConfigurations;
for (const ref of configs) {
  const settings = objects.XCBuildConfiguration[ref.value].buildSettings;
  assert.equal(settings.PRODUCT_BUNDLE_IDENTIFIER, 'dev.weiguang.comic');
  assert.equal(Number(settings.IPHONEOS_DEPLOYMENT_TARGET), 15);
}
assert.match(
  read('ios/App/App/SceneDelegate.swift'),
  /rootViewController = ComicBridgeViewController\(\)/,
  'SceneDelegate 绕过了本地插件桥',
);
if (process.argv.includes('--release')) {
  const publicDir = join(root, 'ios/App/App/public');
  const assets = readdirSync(join(publicDir, 'assets'));
  assert.ok(
    !assets.some((name) =>
      /^(?:Prototype|InteractivePrototype|Demo[^.]*)-/i.test(name),
    ),
    '正式产物包含原型页面',
  );
  assert.ok(
    !existsSync(join(publicDir, 'prototype.html')),
    '正式产物包含交互原型入口',
  );
  for (const name of assets.filter((name) => name.endsWith('.js'))) {
    assert.ok(
      !readFileSync(join(publicDir, 'assets', name), 'utf8').includes(
        'weiguang.interactive-prototype.v1',
      ),
      `正式产物包含演示存储键：${name}`,
    );
  }
}
assert.match(
  read('ios/App/App/Base.lproj/Main.storyboard'),
  /customClass="ComicBridgeViewController"/,
);
assert.match(
  read('ios/App/App/ComicBridgeViewController.swift'),
  /#if DEBUG\s+bridge\?\.registerPluginInstance\(ComicPrototypePlugin\(\)\)/,
  '原型插件必须限于 Debug',
);
assert.match(
  read('ios/App/App/ComicBridgeViewController.swift'),
  /bridge\?\.registerPluginInstance\(ComicImportPlugin\(\)\)/,
  '正式文件导入插件未注册',
);
assert.match(
  read('ios/ComicNative/Sources/ComicNative/ComicArchivePlugin.swift'),
  /CAPPluginMethod\(name: "disposeBook", returnType: CAPPluginReturnPromise\)/,
  '正式副本删除接口未暴露给插件桥',
);
const info = plist.parse(read('ios/App/App/Info.plist'));
assert.match(
  read('ios/App/App/ComicBridgeViewController.swift'),
  /registerPluginInstance\(ComicReaderPlugin\(\)\)/,
  '阅读显示插件未注册',
);
assert.match(
  read('ios/App/App/ComicBridgeViewController.swift'),
  /registerPluginInstance\(ProStorePlugin\(\)\)/,
  'Pro 内购插件未注册',
);
for (const method of ['status', 'purchase', 'restore']) {
  assert.ok(
    read('ios/ComicNative/Sources/ComicNative/ProStorePlugin.swift').includes(
      `CAPPluginMethod(name: "${method}"`,
    ),
    `Pro 内购接口缺失：${method}`,
  );
}
assert.match(
  read('ios/ComicNative/Sources/ComicNative/ProStorePlugin.swift'),
  /productID = "dev\.weiguang\.comic\.pro"/,
  'Pro 商品标识不一致',
);
for (const method of ['getDisplayState', 'setFullscreen']) {
  assert.ok(
    read(
      'ios/ComicNative/Sources/ComicNative/ComicReaderPlugin.swift',
    ).includes(`CAPPluginMethod(name: "${method}"`),
    `阅读显示接口缺失：${method}`,
  );
}
assert.match(
  read('ios/App/App/ComicBridgeViewController.swift'),
  /override var prefersStatusBarHidden: Bool/,
);
// Capacitor 8 SystemBars 以 public 重写了该属性，App 模块的子类再重写会编译失败。
const bridgeClass = read('ios/App/App/ComicBridgeViewController.swift').match(
  /final class ComicBridgeViewController[\s\S]*?\r?\n}\r?\n/,
)?.[0];
assert.ok(bridgeClass, '桥控制器定义缺失');
assert.ok(
  !/override\s+var\s+prefersHomeIndicatorAutoHidden/.test(bridgeClass),
  '桥控制器不能重写 prefersHomeIndicatorAutoHidden',
);
assert.match(
  bridgeClass,
  /override var childForHomeIndicatorAutoHidden: UIViewController\?/,
  '全屏缺少 Home 指示条控制',
);
assert.equal(info.UIViewControllerBasedStatusBarAppearance, true);
assert.ok(!info.NSAppTransportSecurity, '不应放宽网络访问');
assert.ok(!info.UIBackgroundModes, '原型不应申请后台模式');
const privacy = plist.parse(read('ios/App/App/PrivacyInfo.xcprivacy'));
assert.equal(privacy.NSPrivacyTracking, false);
assert.deepEqual(privacy.NSPrivacyCollectedDataTypes, []);
assert.match(
  read('ios/ComicNative/Package.swift'),
  /ZIPFoundation\.git", exact: "0\.9\.20"/,
);
const configPath = join(root, 'ios/App/App/capacitor.config.json');
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(config.appId, 'dev.weiguang.comic');
  assert.ok(!config.server?.url, '构建不应加载远端网页');
}
const html = read('ios/App/App/public/index.html');
assert.match(
  html.replaceAll('&#39;', "'"),
  /connect-src 'none'/,
  '原生内嵌产物没有禁用网页网络连接',
);
console.log(
  'iOS 工程静态检查通过：编译引用、本地包链接、iOS 15、隐私清单、离线 CSP、Debug 原型隔离。',
);
console.log('此检查不编译 Swift，不代表 Xcode 构建或真机性能验收通过。');
