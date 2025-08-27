import * as fs from 'fs';
import { FileSystem } from './index';

export const fsToFileSystem = (incomingFs: typeof fs): FileSystem => {
  return {
    existsSync: incomingFs.existsSync,
    statSync: incomingFs.statSync,
    readdirSync: function(path: string, options: {
      withFileTypes: true;
    }): fs.Dirent[] {
      return incomingFs.readdirSync(path, {
        withFileTypes: options.withFileTypes
      });
    },
    readFileSync: incomingFs.readFileSync,
  }
};
