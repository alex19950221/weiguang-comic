import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { database } from '@/db';
import type { ComicDatabase } from '@/db/schema';
import { ComicArchive, type ComicArchivePlugin } from '@/native/comicArchive';
import { supportsImport } from '@/native/comicImport';
import type { FullscreenPort } from '@/reader/fullscreen';
export interface LibraryServices {
  db: ComicDatabase;
  archive: Pick<
    ComicArchivePlugin,
    'thumbnail' | 'disposeBook' | 'renderPage' | 'clearCache'
  >;
  nativeAvailable: boolean;
  fullscreen?: FullscreenPort;
}
export const defaultLibraryServices: LibraryServices = {
  db: database,
  archive: ComicArchive,
  nativeAvailable: supportsImport(),
};
export const LibraryContext = createContext(defaultLibraryServices);
export const useLibrary = () => useContext(LibraryContext);
