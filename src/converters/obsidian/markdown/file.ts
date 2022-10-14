import path from 'path';

export type FileDesc = { name?: string; path?: string };

export function isPath(searchStr: string) {
  return path.basename(searchStr) !== searchStr;
}

export function findAnyMatchingFile<Data>(fileName: string, filePath: string, tracker: Map<FileDesc, Data>) {
  const files = Array.from(tracker.keys());
  const pathMatch = files.find((desc) => desc.path === filePath);
  if (pathMatch) {
    return pathMatch;
  }
  const nameMatch = files.find((desc) => desc.name === fileName);
  return nameMatch;
}

export function findMatchingFile<Data>(searchStr: string, tracker: Map<FileDesc, Data>, strIsPath: boolean) {
  const files = Array.from(tracker.keys());

  if (strIsPath) {
    return files.find((desc) => desc.path === searchStr);
  } else {
    return files.find((desc) => desc.name === searchStr);
  }
}

export function createFileDesc(searchStr: string, strIsPath: boolean): FileDesc {
  if (strIsPath) {
    return { path: searchStr };
  }
  return { name: searchStr };
}
