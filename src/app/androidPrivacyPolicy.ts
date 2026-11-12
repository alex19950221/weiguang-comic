import type { UiLanguage } from '@/i18n';
import type { PrivacyPolicy } from './privacyPolicy';

/** Android 当前仅提供免费离线功能，政策不展示尚未接入的 Apple 系统服务。 */
export const androidPrivacyPolicy: Record<UiLanguage, PrivacyPolicy> = {
  'zh-Hans': {
    title: '隐私政策',
    effective: '生效日期：2026 年 11 月 12 日',
    intro:
      '微光漫卷（英文名 LumiComic）是一款只读取你自己文件的离线图片阅读器。我们不收集、不上传、不出售任何个人信息。本政策说明安卓版在你的设备上处理哪些数据。',
    sections: [
      {
        title: '我们不收集的信息',
        paragraphs: [
          'App 没有账号与登录，不内置广告、统计分析或跟踪工具。',
          'App 不申请网络权限，不发送网络请求。你的漫画、书架、阅读进度和设置只保存在这台设备上。',
        ],
      },
      {
        title: '保存在你设备上的数据',
        paragraphs: [
          '导入的漫画：App 只读取你在系统文件选择器中主动选择的文件，在 App 私有目录保存一份副本，不修改或删除原文件。',
          '书架信息：系列与分组、阅读进度、书签、阅读设置和导入记录保存在本地数据库中。',
          '页面缓存：原生层生成缩小后的页面图片，存放在系统缓存目录，可在设置中清理，也可能被系统自动清理。',
          '本版关闭 Android 系统备份。你可以在 App 中删除漫画；清除 App 数据或卸载 App 会清除本地书架和导入副本，请自行保留原文件。',
        ],
      },
      {
        title: '使用的系统功能',
        paragraphs: [
          '文件选择由 Android 系统提供。App 不申请访问全部文件的权限，不扫描你的设备。',
          '如果你从系统文件选择器选择云盘文件，该文件提供方可能需要自行下载文件；App 本身不会联网。',
          '本版未接入购买、应用锁或生物识别服务。',
        ],
      },
      {
        title: '未成年人',
        paragraphs: [
          'App 不收集任何人的个人信息，包括未满 14 周岁的未成年人。',
        ],
      },
      {
        title: '政策更新与联系方式',
        paragraphs: [
          '本政策如有变更，会随 App 更新发布，并更新生效日期。',
          '如有疑问，请通过微光漫卷官网 comic.spineapps.com 的支持页面联系我们。',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    effective: 'Effective date: November 12, 2026',
    intro:
      'LumiComic (微光漫卷) is an offline image reader for your own files. We do not collect, upload or sell personal information. This policy describes data handled on your device by the Android app.',
    sections: [
      {
        title: 'Information we do not collect',
        paragraphs: [
          'There are no accounts, sign-in, ads, analytics or tracking tools.',
          'The app does not request internet permission or send network requests. Comics, library data, reading progress and settings stay on this device.',
        ],
      },
      {
        title: 'Data stored on your device',
        paragraphs: [
          'Imported comics: the app reads only files you select in the system file picker and saves a copy in its private directory. It never changes or deletes the originals.',
          'Library data: series, groups, progress, bookmarks, reader settings and import records are stored in a local database.',
          'Page cache: the native layer creates smaller page images in the system cache directory. You can clear them in Settings; Android may also remove them.',
          'Android system backup is disabled in this version. You can delete comics in the app. Clearing app data or uninstalling removes the local library and imported copies, so keep your original files.',
        ],
      },
      {
        title: 'System features',
        paragraphs: [
          'Android provides the file picker. The app does not request all-files access or scan your device.',
          'If you select a cloud file, its document provider may need to download it. The app itself does not connect to the internet.',
          'This version does not include purchases, app locking or biometric authentication.',
        ],
      },
      {
        title: 'Children',
        paragraphs: [
          'The app does not collect personal information from anyone, including children under 14.',
        ],
      },
      {
        title: 'Updates and contact',
        paragraphs: [
          'Changes to this policy will be included in an app update with a new effective date.',
          'For questions, use the support page on the LumiComic website at comic.spineapps.com.',
        ],
      },
    ],
  },
};
