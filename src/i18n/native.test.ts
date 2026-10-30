import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from './en';

// 正式插件的错误原文会经导入记录显示；英文界面不能回退成中文。
const plugins = [
  'ComicImportPlugin',
  'ComicArchivePlugin',
  'ComicStore',
  'ZipDirectory',
];

describe('原生错误文案', () => {
  it('正式 iOS 插件的每条中文错误都有英文翻译', () => {
    const messages = plugins.flatMap((name) =>
      [
        ...readFileSync(
          new URL(
            `../../ios/ComicNative/Sources/ComicNative/${name}.swift`,
            import.meta.url,
          ),
          'utf8',
        ).matchAll(/(?:invalid|reject)\("([^"]*\p{Script=Han}[^"]*)"/gu),
      ].map((match) => match[1]!),
    );
    expect(messages.length).toBeGreaterThan(30);
    expect(messages.filter((message) => !en[message])).toEqual([]);
  });
});
