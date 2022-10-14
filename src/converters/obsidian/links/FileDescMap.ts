import path from 'path';

function isPath(searchStr: string) {
  return path.basename(searchStr) !== searchStr;
}

export class FileDescMap<Data> extends Map<FileDesc, Data> {
  fullRetrieveAndUpdate(fileName: string, filePath: string, defaultData: () => Data) {
    const files = Array.from(this.keys());
    let match = files.find((desc) => desc.path === filePath);
    if (!match) {
      match = files.find((desc) => desc.name === fileName);
    }
    if (!match) {
      match = { path: filePath, name: fileName };
      this.set(match, defaultData());
    }

    //update
    match.name = fileName;
    match.path = filePath;

    return this.get(match) as Data;
  }

  partialRetrieveAndUpdate(searchStr: string, defaultData: () => Data) {
    const files = Array.from(this.keys());
    const isPathBool = isPath(searchStr);
    let match;
    if (isPathBool) {
      match = files.find((desc) => desc.path === searchStr);
    } else {
      match = files.find((desc) => desc.name === searchStr);
    }

    if (!match) {
      if (isPathBool) {
        match = { path: searchStr };
      } else {
        match = { name: searchStr };
      }
      this.set(match, defaultData());
    }

    return this.get(match) as Data;
  }

  findMatchingFile(searchStr: string) {
    const files = Array.from(this.keys());
    const isPathBool = isPath(searchStr);
    let match;
    if (isPathBool) {
      match = files.find((desc) => desc.path === searchStr);
    } else {
      match = files.find((desc) => desc.name === searchStr);
    }
    return match;
  }
}

export type FileDesc = { name?: string; path?: string };
