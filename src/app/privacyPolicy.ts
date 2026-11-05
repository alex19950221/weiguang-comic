import type { UiLanguage } from '@/i18n';

export interface PrivacyPolicySection {
  title: string;
  paragraphs: readonly string[];
}

export interface PrivacyPolicy {
  title: string;
  effective: string;
  intro: string;
  sections: readonly PrivacyPolicySection[];
}

/**
 * App 内「设置 → 隐私政策」与 docs/PRIVACY_POLICY.md（托管为商店隐私政策网址）共用此文本，
 * 由同名测试保证两处一致。改动数据处理方式时必须同步修改这里与生效日期。
 */
export const privacyPolicy: Record<UiLanguage, PrivacyPolicy> = {
  'zh-Hans': {
    title: '隐私政策',
    effective: '生效日期：2026 年 11 月 5 日',
    intro:
      '微光漫卷（英文名 LumiComic）是一款只读取你自己文件的离线图片阅读器。我们不收集、不上传、不出售任何个人信息。本政策说明 App 在你的设备上处理哪些数据。',
    sections: [
      {
        title: '我们不收集的信息',
        paragraphs: [
          'App 没有账号与登录，不内置广告、统计分析或任何第三方 SDK，也不进行跟踪。',
          'App 本身不发送任何网络请求。你的漫画、书架、阅读进度和设置都不会离开这台设备。',
        ],
      },
      {
        title: '保存在你设备上的数据',
        paragraphs: [
          '导入的漫画：默认在 App 内保存一份副本，原文件不会被修改；副本不包含在 iCloud 或电脑备份中。',
          '原位阅读：只保存系统提供的文件访问授权，不复制原件。',
          '书架信息：系列与分组、阅读进度、书签、阅读设置和导入记录，保存在 App 的本地数据库中。',
          '页面缓存：为加快翻页生成的缩小图片，存放在系统缓存目录，空间不足时可能被系统清理。',
          '这些数据只供 App 在本机使用。你可以在 App 中删除漫画；删除 App 会清除以上全部数据。',
        ],
      },
      {
        title: '使用的系统功能',
        paragraphs: [
          '文件访问：App 只能读取你在系统文件选择器中主动选择的文件。',
          '面容 ID、触控 ID 或设备密码（应用锁）：验证由 iOS 完成，App 只得到“是否通过”的结果，无法获取你的生物特征信息。',
          'App 内购买：购买与恢复购买由 Apple 通过 App Store 处理。App 只从系统读取是否已解锁 Pro，开发者不会获得你的支付信息或 Apple 账户信息。',
          '崩溃报告：如果你在 iOS“设置 → 隐私与安全性 → 分析与改进”中选择与 App 开发者共享，Apple 可能向开发者提供不含个人身份信息的崩溃报告。是否共享由你决定。',
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
          '本政策如有变更，会随 App 更新发布，并更新上方的生效日期。',
          '如有疑问，请通过 App Store 产品页中的“App 支持”链接联系我们。',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    effective: 'Effective date: November 5, 2026',
    intro:
      'LumiComic (微光漫卷) is an offline image reader that only opens your own files. We do not collect, upload or sell any personal information. This policy explains what data the app handles on your device.',
    sections: [
      {
        title: 'What we do not collect',
        paragraphs: [
          'There are no accounts or sign-in. The app contains no ads, analytics or third-party SDKs, and it does not track you.',
          'The app itself makes no network requests. Your comics, library, reading progress and settings never leave this device.',
        ],
      },
      {
        title: 'Data stored on your device',
        paragraphs: [
          'Imported comics: by default the app keeps a copy inside the app and never modifies the original file. Copies are excluded from iCloud and computer backups.',
          'Read in place: only the file access permission provided by the system is stored; the original is not copied.',
          'Library information: series and groups, reading progress, bookmarks, reader settings and import history are kept in the app’s local database.',
          'Page cache: downsized images generated for faster page turns are kept in the system cache folder and may be cleared by the system when space is low.',
          'This data is used only by the app on this device. You can delete comics in the app; deleting the app removes all of the data above.',
        ],
      },
      {
        title: 'System features',
        paragraphs: [
          'File access: the app can only read files you choose in the system file picker.',
          'Face ID, Touch ID or device passcode (app lock): verification is handled by iOS. The app only learns whether it succeeded and cannot access your biometric data.',
          'In-app purchase: purchases and restores are handled by Apple through the App Store. The app only reads from the system whether Pro is unlocked; the developer never receives your payment details or Apple Account information.',
          'Crash reports: if you choose to share with app developers in iOS Settings → Privacy & Security → Analytics & Improvements, Apple may provide the developer with crash reports that do not identify you. Sharing is up to you.',
        ],
      },
      {
        title: 'Children',
        paragraphs: [
          'The app does not collect personal information from anyone, including children.',
        ],
      },
      {
        title: 'Changes and contact',
        paragraphs: [
          'If this policy changes, the update will ship with an app update and the effective date above will change.',
          'If you have questions, contact us through the “App Support” link on the App Store product page.',
        ],
      },
    ],
  },
};
