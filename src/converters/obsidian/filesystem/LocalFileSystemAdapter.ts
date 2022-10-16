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

const fourtyMBinBytes = 1000000 * 40;

export class LocalFileSystemAdapter implements CustomFileSystemAdapter {
  private readStream: ReadStream | undefined;
  private readlineInterface: Interface | undefined;
  private resultChunks: string[] = [];
  private resultChunkCharByteSize = 0;
  private postProcessingChunks: string[] = [];
  private postProcessingChunkCharByteSize = 0;

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

  appendToResultFile(targetPath: string, chunk: string) {
    this.resultChunks.push(chunk);
    this.resultChunkCharByteSize += chunk.length * 2; //every char has around 2 bytes
    if (this.resultChunkCharByteSize > fourtyMBinBytes) {
      this.writeResultChunks(targetPath);
    }
  }

  flushResultsFromInitialProcessing(targetPath: string) {
    if (this.resultChunkCharByteSize !== 0) {
      this.writeResultChunks(targetPath);
    }
  }

  private writeResultChunks(targetPath: string) {
    appendFileSync(targetPath, this.resultChunks.join('\n'));
    this.resultChunks = [];
    this.resultChunkCharByteSize = 0;
  }

  initPostProcessingResultFile(resultPath: string) {
    //the converter is build to append to the file, so we dont want to load the whole file into memory at the end, that would be counter to the whole idea
    this.readStream = createReadStream(resultPath, 'utf-8');
    this.readlineInterface = createInterface(this.readStream);
  }

  appendToPostProcessingFile(targetPath: string, chunk: string) {
    this.postProcessingChunks.push(chunk);
    this.postProcessingChunkCharByteSize += chunk.length * 2; //every char has around 2 bytes
    if (this.postProcessingChunkCharByteSize > fourtyMBinBytes) {
      this.writePostProcessingChunks(targetPath);
    }
  }

  endPostProcessingFile(targetPath: string) {
    if (this.postProcessingChunkCharByteSize !== 0) {
      this.writePostProcessingChunks(targetPath);
    }

    this.readlineInterface?.close();
    this.readStream?.close();
  }

  private writePostProcessingChunks(targetPath: string) {
    appendFileSync(targetPath, this.postProcessingChunks.join('\n'));
    this.postProcessingChunks = [];
    this.postProcessingChunkCharByteSize = 0;
  }

  chunkIter() {
    return this.readlineInterface as Interface;
  }
}

function toEntry(dir: string, dirent: Dirent): CustomFileSystemEntry {
  return { isDirectory: dirent.isDirectory.bind(dirent), getName: () => resolve(dir, dirent.name) };
}
