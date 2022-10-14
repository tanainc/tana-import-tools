import { appendFileSync, Dirent, readdirSync, readFileSync } from 'fs';
import path, { resolve } from 'path';
import { convertObsidianFile } from './fileConversion';
import { VaultContext } from '../context';
import { untrackedUidRequest } from './untrackedUidRequest';

enum ChildrenPosition {
  NOT_LAST = 'NOT_LAST',
  LAST = 'LAST',
}

function getChildrenPosition(index: number, dirents: Dirent[]) {
  if (index === dirents.length - 1) {
    return ChildrenPosition.LAST;
  }

  return ChildrenPosition.NOT_LAST;
}

function readFilteredDir(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).filter(
    (dirent) =>
      (dirent.isDirectory() && !dirent.name.endsWith('.github') && !dirent.name.endsWith('.obsidian')) ||
      (!dirent.isDirectory() && dirent.name.endsWith('.md')),
  );
}

export function handleVault(
  dir: string,
  handleDirStart: ReturnType<typeof addParentNodeStart>,
  handleDirEnd: ReturnType<typeof addParentNodeEnd>,
  handleFile: ReturnType<typeof addFileNode>,
  childrenPosition: ChildrenPosition = ChildrenPosition.LAST,
) {
  handleDirStart(dir);
  const dirents = readFilteredDir(dir);
  for (let index = 0; index < dirents.length; index++) {
    const dirent = dirents[index];
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      handleVault(res, handleDirStart, handleDirEnd, handleFile, getChildrenPosition(index, dirents));
    } else {
      handleFile(res, getChildrenPosition(index, dirents));
    }
  }
  handleDirEnd(childrenPosition);
}

export function addParentNodeStart(targetPath: string, today: number, context: VaultContext) {
  return (dir: string) => {
    const name = path.basename(dir);
    const uid = untrackedUidRequest(context);
    appendFileSync(
      targetPath,
      `{
        "uid": "${uid}", 
        "name": "${name}", 
        "createdAt": ${today}, 
        "editedAt": ${today}, 
        "type": "node", 
        "children": [
        `,
    );
  };
}

export function addParentNodeEnd(targetPath: string) {
  return (childrenPosition: ChildrenPosition) => {
    appendFileSync(
      targetPath,
      `]
    }`,
    );
    if (childrenPosition !== ChildrenPosition.LAST) {
      appendFileSync(targetPath, ',');
    }
  };
}

export function addFileNode(targetPath: string, today: number, context: VaultContext) {
  return (file: string, childrenPosition: ChildrenPosition) => {
    //remove the vault root path and the ".md" ending to get the absolute path
    const absoluteFilePath = file.slice(context.vaultPath.length + 1, -3);

    const fileNode = convertObsidianFile(
      path.basename(file).replace('.md', ''),
      absoluteFilePath,
      readFileSync(file, 'utf-8'),
      context,
      today,
    );
    appendFileSync(targetPath, JSON.stringify(fileNode, null, 2));
    if (childrenPosition !== ChildrenPosition.LAST) {
      appendFileSync(targetPath, ',');
    }
  };
}
