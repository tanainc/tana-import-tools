import {
  appendFileSync,
  createReadStream,
  Dirent,
  existsSync,
  readdirSync,
  readFileSync,
  ReadStream,
  renameSync,
  unlinkSync,
} from 'fs';
import { resolve } from 'path';
import { createInterface, Interface } from 'readline';
import { CustomFileSystemAdapter, CustomFileSystemEntry } from './CustomFileSystemAdapter';

export class LocalFileSystemAdapter implements CustomFileSystemAdapter {
  private readStream: ReadStream | undefined;
  private readlineInterface: Interface | undefined;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReadingVault() {}
  readDirectory(dir: string) {
    return readdirSync(dir, { withFileTypes: true }).map(toEntry);
  }
  readFile(file: string) {
    return readFileSync(file, 'utf-8');
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
  initReadingFile(path: string) {
    //the converter is build to append to the file, so we dont want to load the whole file into memory at the end, that would be counter to the whole idea
    this.readStream = createReadStream(path, 'utf-8');
    this.readlineInterface = createInterface(this.readStream);
  }
  lineIter() {
    return this.readlineInterface as Interface;
  }
  endReadingFile() {
    this.readlineInterface?.close();
    this.readStream?.close();
  }
}

function toEntry(dirent: Dirent): CustomFileSystemEntry {
  return { isDirectory: dirent.isDirectory.bind(dirent), getName: () => dirent.name };
}
