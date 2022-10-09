import { appendFileSync, Dirent, readdirSync, readFileSync } from 'fs';
import path, { resolve } from 'path';
import { convertObsidianFile } from './convertObsidianFile';
import { HeadingTracker } from './filterHeadingLinks';
import { VaultContext } from './VaultContext';

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

export function handleVault(
  dir: string,
  handleDirStart: ReturnType<typeof addParentNodeStart>,
  handleDirEnd: ReturnType<typeof addParentNodeEnd>,
  handleFile: ReturnType<typeof addFileNode>,
  childrenPosition: ChildrenPosition = ChildrenPosition.LAST,
) {
  handleDirStart(dir);
  const dirents = readdirSync(dir, { withFileTypes: true });
  for (let index = 0; index < dirents.length; index++) {
    const dirent = dirents[index];
    const res = resolve(dir, dirent.name);
    if (dirent.isDirectory() && !res.endsWith('.github') && !res.endsWith('.obsidian')) {
      handleVault(res, handleDirStart, handleDirEnd, handleFile, getChildrenPosition(index, dirents));
    } else if (res.endsWith('.md')) {
      handleFile(res, getChildrenPosition(index, dirents));
    }
  }
  handleDirEnd(childrenPosition);
}

export function addParentNodeStart(targetPath: string, today: number, vaultContext: VaultContext) {
  return (dir: string) => {
    const name = path.basename(dir);
    const uid = vaultContext.randomUid();
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

export function addFileNode(
  targetPath: string,
  today: number,
  vaultContext: VaultContext,
  headingTracker: HeadingTracker,
) {
  return (file: string, childrenPosition: ChildrenPosition) => {
    const fileNode = convertObsidianFile(
      path.basename(file).replace('.md', ''),
      readFileSync(file, 'utf-8'),
      vaultContext,
      today,
      headingTracker,
    );
    appendFileSync(targetPath, JSON.stringify(fileNode, null, 2));
    if (childrenPosition !== ChildrenPosition.LAST) {
      appendFileSync(targetPath, ',');
    }
  };
}
