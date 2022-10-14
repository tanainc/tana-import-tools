import path from 'path';

export type FileDesc = { name?: string; path?: string };

export function isPath(searchStr: string) {
  return path.basename(searchStr) !== searchStr;
}

export function fullRetrieveDataForFile<Data>(
  fileName: string,
  filePath: string,
  tracker: Map<FileDesc, Data>,
  defaultData: () => Data,
) {
  const files = Array.from(tracker.keys());
  let match = files.find((desc) => desc.path === filePath);
  if (!match) {
    match = files.find((desc) => desc.name === fileName);
  }
  if (!match) {
    match = { path: filePath, name: fileName };
    tracker.set(match, defaultData());
  }

  //update
  match.name = fileName;
  match.path = filePath;

  return tracker.get(match) as Data;
}

export function partialRetrieveDataForFile<Data>(
  searchStr: string,
  tracker: Map<FileDesc, Data>,
  defaultData: () => Data,
) {
  const files = Array.from(tracker.keys());
  const isPathBool = isPath(searchStr);
  let match;
  if (isPathBool) {
    match = files.find((desc) => desc.path === searchStr);
  } else {
    match = files.find((desc) => desc.name === searchStr);
  }

  if (!match) {
    if (isPath(searchStr)) {
      match = { path: searchStr };
    } else {
      match = { name: searchStr };
    }
    tracker.set(match, defaultData());
  }

  return tracker.get(match) as Data;
}
