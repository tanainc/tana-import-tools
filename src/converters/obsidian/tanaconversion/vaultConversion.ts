import { convertObsidianFile } from './fileConversion';
import { VaultContext } from '../VaultContext';
import { untrackedUidRequest } from '../links/genericLinks';
import { basename, CustomFileSystemEntry, SEPARATOR } from '../filesystem/CustomFileSystemAdapter';

enum ChildrenPosition {
  NOT_LAST = 'NOT_LAST',
  LAST = 'LAST',
}

function getChildrenPosition(index: number, dirents: CustomFileSystemEntry[]) {
  if (index === dirents.length - 1) {
    return ChildrenPosition.LAST;
  }

  return ChildrenPosition.NOT_LAST;
}

function readFilteredDir(context: VaultContext, dir: string) {
  return context.fileSystemAdapter.readDirectory(dir).filter((dirent) => {
    const name = dir + SEPARATOR + dirent.getName();
    return (
      (dirent.isDirectory() && !name.endsWith('.github') && !name.endsWith('.obsidian')) ||
      (!dirent.isDirectory() && name.endsWith('.md'))
    );
  });
}

export async function handleVault(
  context: VaultContext,
  dir: string,
  handleDirStart: ReturnType<typeof addParentNodeStart>,
  handleDirEnd: ReturnType<typeof addParentNodeEnd>,
  handleFile: ReturnType<typeof addFileNode>,
  childrenPosition: ChildrenPosition = ChildrenPosition.LAST,
) {
  handleDirStart(dir);
  const dirents = readFilteredDir(context, dir);
  for (let index = 0; index < dirents.length; index++) {
    const dirent = dirents[index];
    const res = dirent.getName();
    if (dirent.isDirectory()) {
      await handleVault(context, res, handleDirStart, handleDirEnd, handleFile, getChildrenPosition(index, dirents));
    } else {
      await handleFile(res, getChildrenPosition(index, dirents));
    }
  }
  handleDirEnd(childrenPosition);
}

export function addParentNodeStart(targetPath: string, today: number, context: VaultContext) {
  return (dir: string) => {
    const name = basename(dir);
    const uid = untrackedUidRequest(context);
    context.fileSystemAdapter.appendToResultFile(
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

export function addParentNodeEnd(context: VaultContext, targetPath: string) {
  return (childrenPosition: ChildrenPosition) => {
    context.fileSystemAdapter.appendToResultFile(
      targetPath,
      `]
    }`,
    );
    if (childrenPosition !== ChildrenPosition.LAST) {
      context.fileSystemAdapter.appendToResultFile(targetPath, ',');
    }
  };
}

export function addFileNode(targetPath: string, today: number, context: VaultContext) {
  return async (file: string, childrenPosition: ChildrenPosition) => {
    //remove the vault root path and the ".md" ending to get the absolute path
    const absoluteFilePath = file.slice(context.vaultPath.length + 1, -3);

    const fileNode = convertObsidianFile(
      basename(file).replace('.md', ''),
      absoluteFilePath,
      await context.fileSystemAdapter.readFile(file),
      context,
      today,
    );
    context.fileSystemAdapter.appendToResultFile(targetPath, JSON.stringify(fileNode, null, 2));
    if (childrenPosition !== ChildrenPosition.LAST) {
      context.fileSystemAdapter.appendToResultFile(targetPath, ',');
    }
  };
}
