/* eslint-disable @typescript-eslint/no-unused-vars */
import * as zip from '@zip.js/zip.js';
import type { FS, ZipFileEntry, ZipEntry, ZipDirectoryEntry } from '@zip.js/zip.js';

import { CustomFileSystemAdapter, SEPARATOR } from './CustomFileSystemAdapter';

export class WebFileSystemAdapter implements CustomFileSystemAdapter {
  private zipFS: FS | undefined;
  private chunks: string[] = [];
  private chunkIndex = 0;

  constructor(private zipBlob: Blob) {}

  async initReadingVault() {
    this.zipFS = new zip.fs.FS() as FS;
    await this.zipFS.importBlob(this.zipBlob);
  }

  readDirectory(dir: string) {
    const result = ((this.zipFS as FS).find(dir) as ZipEntry).children;
    return result.map((entry) => ({
      isDirectory: () => !!(entry as ZipDirectoryEntry).directory,
      getName: () => entry.getFullname(),
    }));
  }

  readFile(file: string) {
    return ((this.zipFS as FS).find(file) as ZipFileEntry<string, string>).getText('utf-8');
  }

  exists(path: string) {
    return !!(this.zipFS as FS).find(path);
  }

  resolve(path: string) {
    return path;
  }

  resolveInDir(dir: string, name: string) {
    return dir + SEPARATOR + name;
  }

  //not necessary for browser
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  removeFile(_targetPath: string) {}
  //not necessary for browser
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  renameFile(_oldPath: string, _newPath: string) {}

  appendToFile(_targetPath: string, chunk: string) {
    this.chunks.push(chunk);
  }

  appendToPostProcessingFile(_targetPath: string, chunk: string) {
    //on local we write into a different file, here we just overwrite the chunks
    this.chunks[this.chunkIndex] = chunk;
    this.chunkIndex++;
  }

  //not necessary for browser
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReadingResultFile(_path: string) {}

  chunkIter() {
    const chunks = this.chunks;
    let index = 0;
    const iterator = {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<{ done: boolean; value?: string }> {
            if (index < chunks.length) {
              const chunk = chunks[index];
              index++;
              return { done: false, value: chunk };
            } else {
              return { done: true };
            }
          },
        };
      },
    };

    return iterator as AsyncIterable<string>;
  }

  endPostProcessingFile() {
    (this.zipFS as FS).remove;
  }

  getResult() {
    return this.chunks.join('');
  }
}
