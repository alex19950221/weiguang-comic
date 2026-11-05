import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { privacyPolicy, type PrivacyPolicy } from './privacyPolicy';

const hosted = readFileSync(
  new URL('../../docs/PRIVACY_POLICY.md', import.meta.url),
  'utf8',
);

function texts(policy: PrivacyPolicy) {
  return [
    policy.title,
    policy.effective,
    policy.intro,
    ...policy.sections.flatMap((section) => [
      section.title,
      ...section.paragraphs,
    ]),
  ];
}

describe('隐私政策', () => {
  it('中英文结构一致，没有空段落', () => {
    const zh = privacyPolicy['zh-Hans'];
    const en = privacyPolicy.en;
    expect(en.sections.map((section) => section.paragraphs.length)).toEqual(
      zh.sections.map((section) => section.paragraphs.length),
    );
    expect([...texts(zh), ...texts(en)].filter((text) => !text.trim())).toEqual(
      [],
    );
  });

  it('托管版本与 App 内文本逐段一致', () => {
    const missing = [
      ...texts(privacyPolicy['zh-Hans']),
      ...texts(privacyPolicy.en),
    ].filter((text) => !hosted.includes(text));
    expect(missing).toEqual([]);
  });
});
