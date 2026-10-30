/** iOS 原生插件的错误原文会写入导入记录并经 t() 显示；与 Swift 源码中的中文逐字对应。 */
export const nativeEn: Record<string, string> = {
  '文件选择器已打开。': 'The file picker is already open.',
  '文件选择器暂不可用。': 'The file picker is unavailable right now.',
  '文件选择授权已失效，请重新选择文件。':
    'File access has expired. Please select the file again.',
  '这个文件正在导入。': 'This file is already being imported.',
  '漫画副本已经存在。': 'A copy of this comic already exists.',
  '请选择 ZIP 或 CBZ 文件。': 'Please choose a ZIP or CBZ file.',
  '文件大小无效。': 'The file size is invalid.',
  '已取消导入。': 'Import cancelled.',
  '文件在导入时发生变化，请重试。':
    'The file changed during import. Please try again.',
  '漫画标识无效。': 'Invalid comic identifier.',
  '缺少文件路径。': 'The file path is missing.',
  '页面参数无效。': 'Invalid page request.',
  '自动裁边在 M3 实现。': 'Automatic border cropping is not available yet.',
  '清理参数无效。': 'Invalid cleanup request.',
  '只能读取应用导入的漫画副本。':
    'Only comic copies imported into the app can be read.',
  '压缩包目录不完整。': 'The archive directory is incomplete.',
  '漫画页不存在。': 'This page does not exist in the comic.',
  '单张图片超过 256 MB，暂不支持。':
    'Images larger than 256 MB are not supported yet.',
  '图片解压大小异常。': 'The image expanded to an unexpected size.',
  '图片校验失败，文件可能已损坏。':
    'Image verification failed. The file may be damaged.',
  '图片已损坏或格式不受支持。':
    'The image is damaged or in an unsupported format.',
  '无法生成漫画预览。': 'Unable to create the page preview.',
  '页面缓存写入失败，请检查可用空间。':
    'Unable to save the page cache. Please check available storage.',
  '只能删除应用内的漫画副本。':
    'Only comic copies inside the app can be deleted.',
  '不是有效的 ZIP 文件。': 'This is not a valid ZIP file.',
  'ZIP 目录缺失或文件已损坏。':
    'The ZIP directory is missing or the file is damaged.',
  '暂不支持分卷 ZIP。': 'Split ZIP archives are not supported yet.',
  'ZIP64 目录无效。': 'The ZIP64 directory is invalid.',
  'ZIP64 分卷或目录不受支持。':
    'This ZIP64 split archive or directory is not supported.',
  'ZIP64 目录越界。': 'The ZIP64 directory is out of bounds.',
  'ZIP64 目录已损坏。': 'The ZIP64 directory is damaged.',
  'ZIP 目录越界或条目过多（上限十万）。':
    'The ZIP directory is out of bounds or has too many entries (limit 100,000).',
  'ZIP 目录已截断。': 'The ZIP directory is truncated.',
  'ZIP 条目无效。': 'A ZIP entry is invalid.',
  'ZIP 条目越界、文件名过多或包含分卷。':
    'A ZIP entry is out of bounds, has too many file names, or spans multiple parts.',
  'ZIP64 条目缺失。': 'A ZIP64 entry field is missing.',
  'ZIP 页面位置越界。': 'A page position in the ZIP is out of bounds.',
  'ZIP 文件已截断。': 'The ZIP file is truncated.',
};
