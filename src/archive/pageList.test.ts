import { describe, expect, it } from 'vitest';
import { naturalCompare, pageList } from './pageList';
import type { ArchiveEntry } from '@/native/comicArchive';

function entry(name: string, index = 0): ArchiveEntry {
  return { index, name, size: 10 };
}

describe('M0 页面列表', () => {
  it('按数字排序而非字符串顺序，支持目录和超长页码', () => {
    const names = ['v10/1.jpg', 'v2/10.jpg', 'v2/2.jpg', 'v2/1.jpg'];
    expect(
      pageList(names.map((name, i) => entry(name, i))).map((page) => page.name),
    ).toEqual(['v2/1.jpg', 'v2/2.jpg', 'v2/10.jpg', 'v10/1.jpg']);
    expect(
      naturalCompare('9007199254740993.jpg', '9007199254740992.jpg'),
    ).toBeGreaterThan(0);
  });
  it('忽略系统垃圾、路径穿越、链接、目录和非图片，保留原生条目索引', () => {
    const entries = [
      '__MACOSX/a.jpg',
      '.DS_Store',
      '../a.jpg',
      '/a.jpg',
      'C:\\a.jpg',
      '.hidden/a.jpg',
      'ComicInfo.xml',
      'a.png',
    ].map((name, i) => entry(name, i));
    entries.push(
      { ...entry('link.jpg', 8), isSymlink: true },
      { ...entry('folder.jpg', 9), isDirectory: true },
    );
    expect(pageList(entries)).toEqual([{ entry: 7, name: 'a.png' }]);
  });
  it('数字相等时按原包索引稳定排序，不按前导零重排', () => {
    expect(
      pageList([entry('02.jpg', 2), entry('2.jpg', 1)]).map(
        (page) => page.entry,
      ),
    ).toEqual([1, 2]);
  });
  it('UTF-8 原始字节优先；旧编码可手动选择，不覆盖 UTF-8 标志的名称', () => {
    const rawName = btoa(
      String.fromCharCode(...new TextEncoder().encode('第2页.jpg')),
    );
    expect(pageList([{ index: 5, size: 10, rawName }])[0]?.name).toBe(
      '第2页.jpg',
    );
    // GBK「中文」 D6 D0 CE C4。
    const gbk = btoa(String.fromCharCode(0xd6, 0xd0, 0xce, 0xc4) + '.jpg');
    expect(pageList([{ index: 7, size: 10, rawName: gbk }])[0]?.name).toBe(
      '中文.jpg',
    );
  });
});
