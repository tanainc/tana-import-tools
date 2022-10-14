export interface CustomFileSystemAdapter {
  initReadingVault: () => void;
  readDirectory: (dir: string) => CustomFileSystemEntry[];
  readFile: (file: string) => string;
  exists: (path: string) => boolean;

  resolve: (path: string) => string;
  resolveInDir: (dir: string, name: string) => string;

  removeFile: (targetPath: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  appendToFile: (targetPath: string, content: string) => void;

  initReadingFile: (path: string) => void;
  lineIter: () => AsyncIterable<string>;
  endReadingFile: () => void;
}

export interface CustomFileSystemEntry {
  isDirectory: () => boolean;
  getName: () => string;
}

export function basename(str: string) {
  return str.slice(str.lastIndexOf(SEPARATOR) + 1);
}

//TODO: add to adapter, in the browser I think its normalized to /
export const SEPARATOR = '/';
