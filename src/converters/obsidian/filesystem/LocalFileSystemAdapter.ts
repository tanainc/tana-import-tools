import {
  appendFileSync,
  createReadStream,
  Dirent,
  existsSync,
  readdirSync,
  ReadStream,
  renameSync,
  unlinkSync,
} from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { createInterface, Interface } from 'readline';
import { CustomFileSystemAdapter, CustomFileSystemEntry } from './CustomFileSystemAdapter';

export class LocalFileSystemAdapter implements CustomFileSystemAdapter {
  private readStream: ReadStream | undefined;
  private readlineInterface: Interface | undefined;

  initReadingVault() {
    return Promise.resolve();
  }

  readDirectory(dir: string) {
    return readdirSync(dir, { withFileTypes: true }).map((dirent) => toEntry(dir, dirent));
  }

  readFile(file: string) {
    return readFile(file, 'utf-8');
  }

  exists(path: string) {
    return existsSync(path);
  }

  resolve(path: string) {
    return resolve(path);
  }

  resolveInDir(dir: string, name: string) {
    return resolve(dir, name);
  }

  removeFile(targetPath: string) {
    unlinkSync(targetPath);
  }

  renameFile(oldPath: string, newPath: string) {
    renameSync(oldPath, newPath);
  }

  appendToFile(targetPath: string, content: string) {
    appendFileSync(targetPath, content);
  }

  appendToPostProcessingFile(targetPath: string, content: string) {
    return this.appendToFile(targetPath, content);
  }

  initReadingResultFile(path: string) {
    //the converter is build to append to the file, so we dont want to load the whole file into memory at the end, that would be counter to the whole idea
    this.readStream = createReadStream(path, 'utf-8');
    this.readlineInterface = createInterface(this.readStream);
  }

  chunkIter() {
    return this.readlineInterface as Interface;
  }

  endPostProcessingFile() {
    this.readlineInterface?.close();
    this.readStream?.close();
  }
}

function toEntry(dir: string, dirent: Dirent): CustomFileSystemEntry {
  return { isDirectory: dirent.isDirectory.bind(dirent), getName: () => resolve(dir, dirent.name) };
}
