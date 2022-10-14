export interface CustomFileSystemAdapter {
  initReadingVault: () => Promise<void>;
  readDirectory: (dir: string) => CustomFileSystemEntry[];
  readFile: (file: string) => Promise<string>;
  exists: (path: string) => boolean;

  resolve: (path: string) => string;
  resolveInDir: (dir: string, name: string) => string;

  removeFile: (targetPath: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  appendToFile: (targetPath: string, chunk: string) => void;
  appendToPostProcessingFile: (targetPath: string, chunk: string) => void;

  initReadingResultFile: (path: string) => void;
  /**
   * Return an iterable to read chunks from the already written file.
   *
   * Local the chunks are lines. Online the chunks are the same chunks that where written.
   */
  chunkIter: () => AsyncIterable<string>;
  endPostProcessingFile: () => void;
}

export interface CustomFileSystemEntry {
  isDirectory: () => boolean;
  getName: () => string;
}

//TODO: add to adapter
export function basename(str: string) {
  return str.slice(str.lastIndexOf(SEPARATOR) + 1);
}

//TODO: add "join" method to adapter
//in the browser I think its normalized to / but not on every os
export const SEPARATOR = '/';