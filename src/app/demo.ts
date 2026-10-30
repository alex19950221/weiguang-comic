import { computed, signal } from '@preact/signals';
import { parseComicName, seriesKey } from '@/library/series';
import type { VolumeUnit } from '@/library/series';
import type { SpreadCover } from '@/reader/spread';

export type Motif = 'mountain' | 'town' | 'space' | 'daily' | 'sea' | 'forest';
/** designed 为原型自绘封面；其余模拟真实文件里常见的封面比例与缺失情况。 */
export type CoverShape =
  'designed' | 'portrait' | 'landscape' | 'tall' | 'none';
export type DemoSample = 'curated' | 'realistic' | 'empty';
export interface DemoBook {
  id: string;
  fileName: string;
  /** 由文件名识别出的系列名。 */
  title: string;
  volume: number | null;
  unit: VolumeUnit;
  subtitle?: string;
  motif: Motif;
  pages: number;
  added: number;
  size: number;
  format: string;
  cover: CoverShape;
  images?: string[];
}
export interface DemoGroup {
  id: string;
  name: string;
}

const MB = 1024 * 1024;
function makeBook(
  id: string,
  fileName: string,
  rest: Omit<
    DemoBook,
    'id' | 'fileName' | 'title' | 'volume' | 'unit' | 'format'
  > & {
    format?: string;
  },
): DemoBook {
  const parsed = parseComicName(fileName);
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1];
  return {
    id,
    fileName,
    ...parsed,
    format: extension ? extension.toUpperCase() : '图片文件夹',
    ...rest,
  };
}

/** 全部为自绘矢量视觉样张，仅供独立交互原型使用，不是漫画资源。 */
export const sampleBooks: readonly DemoBook[] = [
  ['mountain-1', '山海之间 第01卷.cbz', '风从山的那边来', 'mountain', 8],
  ['town-1', '雨落小巷 第01卷.cbz', '小城里的慢日子', 'town', 7],
  ['space-1', '星间邮局 第01卷.cbz', '寄往明天的信', 'space', 6],
  ['daily-1', '慢慢日常 第01卷.cbz', '一点点，好好生活', 'daily', 5],
  ['sea-1', '沿着海岸走 第01卷.cbz', '在蓝色尽头相遇', 'sea', 4],
  ['forest-1', '森林食堂 第01卷.cbz', '今天也有热汤', 'forest', 3],
  ['mountain-2', '山海之间 第02卷.cbz', '在另一座山醒来', 'mountain', 2],
  ['space-2', '星间邮局 第02卷.cbz', '月亮的回信', 'space', 1],
].map(([id, fileName, subtitle, motif, added]) =>
  makeBook(String(id), String(fileName), {
    subtitle: String(subtitle),
    motif: motif as Motif,
    pages: 12,
    added: Number(added),
    size: Math.round((31 + Number(added) * 2.7) * MB),
    cover: 'designed',
  }),
);

/** 模拟真实书架：命名混乱、封面比例不一、页数和数量都更大。书名均为虚构。 */
export const realisticBooks: readonly DemoBook[] = (() => {
  const books: DemoBook[] = [];
  let added = 1000;
  const push = (
    fileName: string,
    motif: Motif,
    pages: number,
    sizeMB: number,
    cover: CoverShape = 'portrait',
  ) =>
    books.push(
      makeBook(`r-${books.length + 1}`, fileName, {
        motif,
        pages,
        added: added--,
        size: Math.round(sizeMB * MB),
        cover,
      }),
    );
  for (let volume = 1; volume <= 12; volume++)
    push(
      volume === 7
        ? '灯塔守望者_v07.cbz'
        : `[晨光社] 灯塔守望者 Vol.${String(volume).padStart(2, '0')} (20${18 + Math.ceil(volume / 4)}) [扫图组].cbz`,
      'sea',
      178 + (volume % 4) * 6,
      82 + volume * 1.7,
    );
  for (let volume = 1; volume <= 20; volume++)
    if (volume !== 5)
      push(
        `孤岛日记_v${String(volume).padStart(2, '0')}.zip`,
        'forest',
        164,
        64,
      );
  for (let chapter = 1; chapter <= 8; chapter++)
    push(`云端之上 第${chapter}话.cbz`, 'space', 58, 46, 'tall');
  for (let chapter = 1; chapter <= 5; chapter++)
    push(
      `Midnight Bakery Ch.${String(chapter).padStart(2, '0')}.cbz`,
      'daily',
      32,
      24,
    );
  for (let volume = 1; volume <= 3; volume++)
    push(`旧城往事 - 0${volume}.rar`, 'town', 196, 118);
  push('星辰列车 第 1 册.zip', 'mountain', 204, 97);
  push('【汉化】星辰列车 第 2 册.zip', 'mountain', 198, 95);
  push('纸飞机 #1.cbr', 'sea', 88, 41);
  push('纸飞机 #2.cbr', 'sea', 92, 43);
  push('The Quiet Garden Complete Edition.cbz', 'forest', 320, 412);
  push('海边画集（横版）.cbz', 'sea', 40, 58, 'landscape');
  push(
    '一个特别特别长的文件名用来看看书名在卡片上会怎么截断 完全版 上卷.cbz',
    'mountain',
    232,
    121,
  );
  push('扫描_20231105_未整理.zip', 'town', 76, 210, 'none');
  push('速写本 2023', 'daily', 48, 132);
  push('无题.zip', 'space', 24, 12, 'none');
  push('雨季短篇集.cbz', 'town', 140, 66);
  push('森林食堂 特别篇.cbz', 'forest', 36, 21, 'landscape');
  push('00_封面测试.zip', 'mountain', 6, 4, 'none');
  return books;
})();

const allSampleBooks = [...sampleBooks, ...realisticBooks];
export const bookSeriesKey = (book: DemoBook) => seriesKey(book.title);
export const volumeText = (book: DemoBook) =>
  book.volume === null ? '' : `第 ${book.volume} ${book.unit}`;
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / 1024 / MB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export interface DemoProgress {
  page: number;
  at: number;
}
export interface DemoPreferences {
  /** system 跟随系统深浅色。 */
  theme: 'system' | 'paper' | 'night';
  mode: 'paged' | 'scroll' | 'spread';
  direction: 'ltr' | 'rtl';
  background: 'paper' | 'dark' | 'white';
  fit: 'page' | 'width';
  spreadCover: SpreadCover;
  brightness: number;
  remember: boolean;
}
interface SavedDemo {
  progress: Record<string, DemoProgress>;
  /** 收藏按系列记录。 */
  favorites: string[];
  bookmarks: Record<string, number[]>;
  preferences: DemoPreferences;
  /** 已看过阅读器点按分区说明。 */
  guideSeen: boolean;
  sample: DemoSample;
  groups: DemoGroup[];
  /** 系列键 → 分组 ID；未出现的系列为未分组。 */
  seriesGroups: Record<string, string>;
  /** 从书架删除的演示书目 ID。 */
  removed: string[];
}
const key = 'weiguang.interactive-prototype.v1';
const defaults: SavedDemo = {
  progress: {
    'mountain-1': { page: 3, at: 8 },
    'space-1': { page: 5, at: 7 },
    'town-1': { page: 11, at: 6 },
    'r-1': { page: 183, at: 5 },
    'r-2': { page: 189, at: 4 },
    'r-3': { page: 56, at: 9 },
    'r-13': { page: 40, at: 3 },
    'r-32': { page: 57, at: 2 },
    'r-33': { page: 21, at: 10 },
  },
  favorites: ['山海之间', '星间邮局', '森林食堂', '灯塔守望者'],
  bookmarks: { 'mountain-1': [1] },
  preferences: {
    theme: 'system',
    mode: 'paged',
    direction: 'ltr',
    background: 'paper',
    fit: 'page',
    spreadCover: 'alone',
    brightness: 100,
    remember: true,
  },
  guideSeen: false,
  sample: 'curated',
  groups: [
    { id: 'daily', name: '日常与旅行' },
    { id: 'fantasy', name: '想象与冒险' },
  ],
  seriesGroups: {
    山海之间: 'daily',
    雨落小巷: 'daily',
    慢慢日常: 'daily',
    沿着海岸走: 'daily',
    星间邮局: 'fantasy',
    森林食堂: 'fantasy',
  },
  removed: [],
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const knownSeries = new Set(allSampleBooks.map(bookSeriesKey));

function restore(): SavedDemo {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!record(data)) return structuredClone(defaults);
    const progress: Record<string, DemoProgress> = {};
    const bookmarks: Record<string, number[]> = {};
    for (const book of allSampleBooks) {
      const value = record(data.progress) ? data.progress[book.id] : undefined;
      if (
        record(value) &&
        typeof value.page === 'number' &&
        Number.isInteger(value.page) &&
        value.page >= 0 &&
        value.page < book.pages &&
        typeof value.at === 'number' &&
        Number.isFinite(value.at)
      )
        progress[book.id] = { page: value.page, at: value.at };
      const marks = record(data.bookmarks)
        ? data.bookmarks[book.id]
        : undefined;
      if (Array.isArray(marks))
        bookmarks[book.id] = [
          ...new Set(
            marks.filter(
              (page): page is number =>
                typeof page === 'number' &&
                Number.isInteger(page) &&
                page >= 0 &&
                page < book.pages,
            ),
          ),
        ];
    }
    const p = record(data.preferences) ? data.preferences : {};
    const preferences: DemoPreferences = {
      theme: p.theme === 'night' || p.theme === 'paper' ? p.theme : 'system',
      mode: p.mode === 'scroll' || p.mode === 'spread' ? p.mode : 'paged',
      direction: p.direction === 'rtl' ? 'rtl' : 'ltr',
      background:
        p.background === 'dark' || p.background === 'white'
          ? p.background
          : 'paper',
      fit: p.fit === 'width' ? 'width' : 'page',
      spreadCover: p.spreadCover === 'paired' ? 'paired' : 'alone',
      brightness:
        typeof p.brightness === 'number' && Number.isFinite(p.brightness)
          ? Math.min(100, Math.max(30, p.brightness))
          : 100,
      remember: p.remember !== false,
    };
    const groups = Array.isArray(data.groups)
      ? data.groups
          .filter(
            (group): group is DemoGroup =>
              record(group) &&
              typeof group.id === 'string' &&
              typeof group.name === 'string' &&
              group.name.trim().length > 0,
          )
          .map(({ id, name }) => ({ id, name: name.trim().slice(0, 20) }))
      : structuredClone(defaults.groups);
    const seriesGroups: Record<string, string> = {};
    const savedGroups = record(data.seriesGroups)
      ? data.seriesGroups
      : defaults.seriesGroups;
    for (const [series, group] of Object.entries(savedGroups))
      if (knownSeries.has(series) && groups.some((item) => item.id === group))
        seriesGroups[series] = String(group);
    // 旧版本按书目 ID 收藏，迁移为系列键。
    const favorites = Array.isArray(data.favorites)
      ? [
          ...new Set(
            data.favorites.flatMap((id) => {
              if (typeof id !== 'string') return [];
              const book = allSampleBooks.find((item) => item.id === id);
              if (book) return [bookSeriesKey(book)];
              return knownSeries.has(id) ? [id] : [];
            }),
          ),
        ]
      : [];
    return {
      progress,
      bookmarks,
      preferences,
      favorites,
      guideSeen: data.guideSeen === true,
      sample:
        data.sample === 'realistic' || data.sample === 'empty'
          ? data.sample
          : 'curated',
      groups,
      seriesGroups,
      removed: Array.isArray(data.removed)
        ? data.removed.filter(
            (id): id is string =>
              typeof id === 'string' &&
              allSampleBooks.some((book) => book.id === id),
          )
        : [],
    };
  } catch {
    return structuredClone(defaults);
  }
}
export const demoState = signal<SavedDemo>(restore());
/** 本次会话新加入的图片画册与模拟导入结果，刷新后移除。 */
export const sessionBooks = signal<DemoBook[]>([]);
export const demoBooks = computed(() => {
  const state = demoState.value;
  const base =
    state.sample === 'curated'
      ? sampleBooks
      : state.sample === 'realistic'
        ? realisticBooks
        : [];
  return [...sessionBooks.value, ...base].filter(
    (book) => !state.removed.includes(book.id),
  );
});
export const demoNotice = signal('');
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function notify(text: string) {
  demoNotice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    demoNotice.value = '';
  }, 2600);
}
function save(next: SavedDemo) {
  demoState.value = next;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    notify('浏览器存储不可用，本次体验仍可继续');
  }
}
export function preference(patch: Partial<DemoPreferences>) {
  save({
    ...demoState.value,
    preferences: { ...demoState.value.preferences, ...patch },
  });
}
export function setSample(sample: DemoSample) {
  save({ ...demoState.value, sample });
}
export function dismissGuide() {
  if (!demoState.value.guideSeen) save({ ...demoState.value, guideSeen: true });
}
export function saveProgress(book: DemoBook, page: number) {
  if (!demoState.value.preferences.remember) return;
  save({
    ...demoState.value,
    progress: {
      ...demoState.value.progress,
      [book.id]: { page, at: Date.now() },
    },
  });
}
/** 手动标记已读或未读；未读即清除阅读位置。 */
export function markRead(books: readonly DemoBook[], read: boolean) {
  const progress = { ...demoState.value.progress };
  for (const book of books)
    if (read) progress[book.id] = { page: book.pages - 1, at: Date.now() };
    else delete progress[book.id];
  save({ ...demoState.value, progress });
  notify(read ? '已标记为读完' : '已标记为未读');
}
export function favorite(series: string) {
  const found = demoState.value.favorites.includes(series);
  save({
    ...demoState.value,
    favorites: found
      ? demoState.value.favorites.filter((item) => item !== series)
      : [...demoState.value.favorites, series],
  });
  notify(found ? '已移出收藏' : '已加入收藏');
}
export function bookmark(id: string, page: number) {
  const marks = demoState.value.bookmarks[id] ?? [];
  const found = marks.includes(page);
  save({
    ...demoState.value,
    bookmarks: {
      ...demoState.value.bookmarks,
      [id]: found
        ? marks.filter((item) => item !== page)
        : [...marks, page].sort((a, b) => a - b),
    },
  });
  notify(found ? '已移除这页书签' : '已记住这一页');
}
export function createGroup(name: string): string | null {
  const trimmed = name.trim().slice(0, 20);
  if (!trimmed) return null;
  const existing = demoState.value.groups.find(
    (group) => group.name === trimmed,
  );
  if (existing) return existing.id;
  const id = `g-${Date.now().toString(36)}`;
  save({
    ...demoState.value,
    groups: [...demoState.value.groups, { id, name: trimmed }],
  });
  notify(`已新建分组“${trimmed}”`);
  return id;
}
export function moveSeries(series: string, group: string | null) {
  const seriesGroups = { ...demoState.value.seriesGroups };
  if (group) seriesGroups[series] = group;
  else delete seriesGroups[series];
  save({ ...demoState.value, seriesGroups });
  const name = demoState.value.groups.find((item) => item.id === group)?.name;
  notify(name ? `已移到“${name}”` : '已移出分组');
}
/** 从书架删除：演示书目记入已删除列表，本次添加的图片画册直接释放。 */
export function removeBooks(books: readonly DemoBook[]) {
  const ids = new Set(books.map((book) => book.id));
  for (const book of sessionBooks.value)
    if (ids.has(book.id))
      book.images?.forEach((url) => URL.revokeObjectURL(url));
  sessionBooks.value = sessionBooks.value.filter((book) => !ids.has(book.id));
  const progress = { ...demoState.value.progress };
  const bookmarks = { ...demoState.value.bookmarks };
  for (const id of ids) {
    delete progress[id];
    delete bookmarks[id];
  }
  save({
    ...demoState.value,
    progress,
    bookmarks,
    removed: [
      ...new Set([
        ...demoState.value.removed,
        ...[...ids].filter((id) =>
          allSampleBooks.some((book) => book.id === id),
        ),
      ]),
    ],
  });
  notify(books.length > 1 ? `已删除 ${books.length} 卷` : '已从书架删除');
}
export function restoreRemoved() {
  save({ ...demoState.value, removed: [] });
  notify('已恢复全部演示书目');
}
export function openDemoBook(book: DemoBook) {
  location.hash = `read/${book.id}`;
}
export function openSeries(series: string) {
  location.hash = `series/${encodeURIComponent(series)}`;
}

export type ImportStage =
  | 'waiting'
  | 'copying'
  | 'checking'
  | 'saving'
  | 'done'
  | 'duplicate'
  | 'failed'
  | 'cancelled';
export interface DemoImportJob {
  id: string;
  fileName: string;
  size: number;
  stage: ImportStage;
  progress: number;
  message?: string;
  /** 模拟用：检查阶段是否判为加密包。 */
  encrypted?: boolean;
}
export const demoImports = signal<DemoImportJob[]>([]);
const finalStages: readonly ImportStage[] = [
  'done',
  'duplicate',
  'failed',
  'cancelled',
];
export const isImportFinished = (job: DemoImportJob) =>
  finalStages.includes(job.stage);
let importTimer: ReturnType<typeof setInterval> | undefined;

function importedBook(job: DemoImportJob): DemoBook {
  const realistic = job.fileName.includes('灯塔守望者');
  return makeBook(`import-${job.id}`, job.fileName, {
    subtitle: realistic ? undefined : '刚刚导入的一卷',
    motif: realistic ? 'sea' : 'mountain',
    pages: realistic ? 186 : 12,
    added: Date.now(),
    size: job.size,
    cover: realistic ? 'portrait' : 'designed',
  });
}
function tickImports() {
  const jobs = demoImports.value;
  const index = jobs.findIndex((job) => !isImportFinished(job));
  if (index === -1) {
    clearInterval(importTimer);
    importTimer = undefined;
    return;
  }
  const job = { ...jobs[index]! };
  if (job.stage === 'waiting') job.stage = 'copying';
  else if (job.stage === 'copying') {
    job.progress = Math.min(1, job.progress + 0.18);
    if (job.progress >= 1) job.stage = 'checking';
  } else if (job.stage === 'checking') {
    if (job.encrypted) {
      job.stage = 'failed';
      job.message = '压缩包设置了密码，暂时无法读取';
    } else if (demoBooks.value.some((book) => book.fileName === job.fileName)) {
      job.stage = 'duplicate';
      job.message = '书架上已有这本，已跳过';
    } else job.stage = 'saving';
  } else if (job.stage === 'saving') {
    job.stage = 'done';
    sessionBooks.value = [importedBook(job), ...sessionBooks.value];
  }
  demoImports.value = jobs.map((item, position) =>
    position === index ? job : item,
  );
}
/** 模拟一次三个文件的导入：一本新卷、一本重复、一本加密包。 */
export function simulateImport() {
  const books = demoBooks.value;
  const fileName =
    demoState.value.sample === 'realistic'
      ? '[晨光社] 灯塔守望者 Vol.13 (2024) [扫图组].cbz'
      : `山海之间 第${String(
          Math.max(
            0,
            ...books
              .filter((book) => book.title === '山海之间')
              .map((book) => book.volume ?? 0),
          ) + 1,
        ).padStart(2, '0')}卷.cbz`;
  const stamp = Date.now().toString(36);
  const sizeOf = (name: string) =>
    books.find((book) => book.fileName === name)?.size ?? 38 * MB;
  const duplicate = books[books.length - 1]?.fileName ?? fileName;
  demoImports.value = [
    ...demoImports.value.filter((job) => !isImportFinished(job)),
    { id: `${stamp}a`, fileName, size: 92 * MB, stage: 'waiting', progress: 0 },
    {
      id: `${stamp}b`,
      fileName: duplicate,
      size: sizeOf(duplicate),
      stage: 'waiting',
      progress: 0,
    },
    {
      id: `${stamp}c`,
      fileName: '加密的合集.zip',
      size: 156 * MB,
      stage: 'waiting',
      progress: 0,
      encrypted: true,
    },
  ];
  importTimer ??= setInterval(tickImports, 180);
}
export function cancelImport(id: string) {
  demoImports.value = demoImports.value.map((job) =>
    job.id === id && (job.stage === 'waiting' || job.stage === 'copying')
      ? { ...job, stage: 'cancelled', message: '已取消，未保存副本' }
      : job,
  );
}
export function clearFinishedImports() {
  demoImports.value = demoImports.value.filter((job) => !isImportFinished(job));
}

export async function addLocalImages(files: readonly File[]): Promise<void> {
  if (!files.length) return;
  if (files.length > 12) throw new Error('一次最多添加 12 张图片');
  const urls: string[] = [];
  try {
    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('浏览器预览支持 JPG、PNG、WebP 图片');
      if (file.size > 8 * 1024 * 1024) throw new Error('预览图片请小于 8 MB');
      const bitmap = await createImageBitmap(file);
      try {
        const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('浏览器暂时无法生成图片预览');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error('图片预览生成失败')),
            'image/jpeg',
            0.88,
          ),
        );
        urls.push(URL.createObjectURL(blob));
      } finally {
        bitmap.close();
      }
    }
    sessionBooks.value = [
      makeBook(crypto.randomUUID(), files[0]!.name.replace(/\.[^.]+$/, ''), {
        subtitle: '本地图片画册',
        motif: 'daily',
        pages: urls.length,
        added: Date.now(),
        size: files.reduce((total, file) => total + file.size, 0),
        format: '图片',
        cover: 'portrait',
        images: urls,
      }),
      ...sessionBooks.value,
    ];
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
}
