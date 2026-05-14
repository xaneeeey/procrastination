// Expand a command template using token substitution.
//
// Tokens (POSIX-style, also accept $file for parity with the user's example):
//   $file       absolute path of the current file
//   $fileBase   filename without extension
//   $fileName   filename with extension
//   $ext        extension including dot (e.g. ".cpp")
//   $dir        directory containing the file

export function expandCommand(template: string, filePath: string): string {
  const segs = filePath.split(/[\\/]/);
  const fileName = segs[segs.length - 1] || filePath;
  const dotIdx = fileName.lastIndexOf('.');
  const fileBase = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : '';
  const dir = segs.slice(0, -1).join('/') || '/';

  return template
    .replaceAll('$fileBase', fileBase)
    .replaceAll('$fileName', fileName)
    .replaceAll('$file', filePath)
    .replaceAll('$ext', ext)
    .replaceAll('$dir', dir);
}

export function extensionOf(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0) return '';
  return fileName.slice(idx).toLowerCase();
}
