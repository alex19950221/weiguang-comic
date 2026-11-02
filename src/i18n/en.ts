import { shelfEn } from './shelf.en';
import { readerEn } from './reader.en';
import { nativeEn } from './native.en';
import { proEn } from './pro.en';
/** 中文原文 → 英文。界面文案以中文为键，缺失时回退到中文。 */
export const en: Record<string, string> = {
  微光漫画: 'LumiComic',
  书架: 'Library',
  还没有漫画: 'No comics yet',
  '从「文件」导入 ZIP、CBZ、RAR 或整个图片文件夹，系列会自动按卷、话排好。':
    'Import ZIP, CBZ, RAR or a whole image folder from Files. Series are sorted by volume and chapter for you.',
  导入漫画: 'Import comics',
  '导入功能在 M1 实现': 'Import arrives in M1',
  '正在打开书架…': 'Opening library…',
  '正在打开…': 'Opening…',
  暂时无法读取书架: 'Unable to open the library',
  重试: 'Retry',
  '从「文件」选择自己的 ZIP 或 CBZ 漫画，可一次选择多个文件。':
    'Choose your own ZIP or CBZ comics from Files. You can select several files at once.',
  '请在支持文件导入的移动端应用中添加漫画。':
    'Add comics in the mobile app with file import support.',
  '正在选择文件…': 'Choosing files…',
  已导入的漫画: 'Imported comics',
  '共 {0} 本漫画': '{0} comics',
  '{0} 页': '{0} pages',
  导入记录: 'Imports',
  等待导入: 'Waiting',
  正在复制: 'Copying',
  正在检查图片: 'Checking images',
  正在保存: 'Saving',
  已导入: 'Imported',
  '书架中已存在，已跳过': 'Already in your library, skipped',
  导入失败: 'Import failed',
  已取消: 'Cancelled',
  取消: 'Cancel',
  '正在复制「{0}」': 'Copying “{0}”',
  '取消导入「{0}」': 'Cancel import of “{0}”',
  '上次导入已中断，请重新选择文件。':
    'Import was interrupted. Please select the file again.',
  '未完成的副本将在下次打开时继续清理。':
    'Unfinished copies will be cleaned up when you reopen the app.',
  '暂时无法继续导入，请关闭后重新打开应用。':
    'Unable to continue importing. Please close and reopen the app.',
  '暂时无法导入，请重新选择文件。':
    'Unable to import. Please select the file again.',
  '取消未完成，请稍后重试。': 'Unable to cancel. Please try again.',
  '目前支持导入 ZIP 和 CBZ 文件。':
    'ZIP and CBZ files are currently supported.',
  '目前支持导入 ZIP、CBZ 和 PDF 文件。':
    'ZIP, CBZ and PDF files are currently supported.',
  'PDF 中没有可读取的页面。': 'No readable pages were found in the PDF.',
  '目前支持导入 ZIP、CBZ、PDF 和 EPUB 文件。':
    'ZIP, CBZ, PDF and EPUB files are currently supported.',
  '暂不支持加密或受版权保护的 EPUB，请选择未加密的自有文件。':
    'Encrypted or DRM-protected EPUBs are not supported. Please choose an unencrypted file you own.',
  '这本 EPUB 以文字为主，目前只支持图片漫画 EPUB。':
    'This EPUB is mostly text. Only image-based comic EPUBs are supported.',
  'EPUB 中没有可读取的漫画图片。':
    'No readable comic images were found in the EPUB.',
  '复制结果无效，请重新选择文件。':
    'The copy is invalid. Please select the file again.',
  '文件校验失败，请重新选择文件。':
    'File verification failed. Please select the file again.',
  '暂不支持加密压缩包，请选择未加密的自有文件。':
    'Encrypted archives are not supported. Please choose an unencrypted file you own.',
  '压缩包中没有可读取的图片。': 'No readable images were found in the archive.',
  '导入失败，请重新选择文件。': 'Import failed. Please select the file again.',
  ...shelfEn,
  ...readerEn,
  ...nativeEn,
  ...proEn,
};
