export type IconName =
  | 'book'
  | 'shelf'
  | 'clock'
  | 'heart'
  | 'settings'
  | 'search'
  | 'plus'
  | 'arrow'
  | 'left'
  | 'right'
  | 'grid'
  | 'list'
  | 'chevron'
  | 'sun'
  | 'moon'
  | 'close'
  | 'folder'
  | 'bookmark'
  | 'expand'
  | 'zoom'
  | 'check'
  | 'upload'
  | 'leaf'
  | 'more'
  | 'download';
const paths: Record<IconName, string> = {
  book: 'M12 5.5C9 3.5 5 3.5 3 4.5v15c3-1 6-1 9 1 3-2 6-2 9-1v-15c-2-1-6-1-9 1Zm0 0v15',
  shelf: 'M4 3v18M20 3v18M4 10h16M4 18h16M8 4v6m4-7v7m4-6 2 6M8 13v5m4-5v5',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  heart:
    'M20.8 4.7c-2-2-5.3-1.6-7.2.4L12 6.7l-1.6-1.6C8.5 3.1 5.2 2.7 3.2 4.7c-2.3 2.2-2.2 5.5 0 7.8L12 21l8.8-8.5c2.2-2.3 2.3-5.6 0-7.8Z',
  settings:
    'm9.5 3-.7 2.2-2 .9-2.2-.5L2 10l1.6 1.7v2.1L2 15.5l2.6 4.4 2.2-.5 2 .9.7 2.2h5l.7-2.2 2-.9 2.2.5 2.6-4.4-1.6-1.7v-2.1L22 10l-2.6-4.4-2.2.5-2-.9L14.5 3h-5ZM15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
  search: 'M16.5 10a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Zm-1.8 4.7L21 21',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  left: 'm15 5-7 7 7 7',
  right: 'm9 5 7 7-7 7',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  list: 'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',
  chevron: 'm6 9 6 6 6-6',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4m0-15.6-1.4 1.4M5.6 18.4l-1.4 1.4',
  moon: 'M21 13.4A9 9 0 0 1 10.6 3a9 9 0 1 0 10.4 10.4Z',
  close: 'm6 6 12 12M6 18 18 6',
  folder: 'M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10H3V6Z',
  bookmark: 'M6 3h12v19l-6-4-6 4V3Z',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  zoom: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 7 7M7 10h6m-3-3v6',
  check: 'm5 12 4 4L19 6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  leaf: 'M20 3c-11-1-17 4-15 11 2 7 15 7 15-11ZM5 20 16 8',
  more: 'M4 12h.1m7.9 0h.1m7.9 0h.1',
  download: 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.65"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
