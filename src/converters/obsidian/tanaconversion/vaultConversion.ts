import { convertObsidianFile } from './fileConversion';
import { VaultContext } from '../VaultContext';
import { untrackedUidRequest } from '../links/genericLinks';
import { basename, CustomFileSystemEntry, SEPARATOR } from '../filesystem/CustomFileSystemAdapter';

export enum ChildrenPosition {
  NOT_LAST = 'NOT_LAST',
  LAST = 'LAST',
}

function getChildrenPosition(index: number, dirents: CustomFileSystemEntry[]) {
  if (index === dirents.length - 1) {
    return ChildrenPosition.LAST;
  }

  return ChildrenPosition.NOT_LAST;
}

function readFilteredAndSortedDir(context: VaultContext, dir: string) {
  return (
    context.adapter
      .readDirectory(dir)
      .filter((dirent) => {
        const name = dir + SEPARATOR + dirent.getName();
        return (
          (dirent.isDirectory() && !name.endsWith('.github') && !name.endsWith('.obsidian')) ||
          (!dirent.isDirectory() && name.endsWith('.md'))
        );
      })
      //TODO: this is a hack to prevent the files in the zip to have a different order, so that we can have similar tests
      .sort((a, b) => a.getName().localeCompare(b.getName()))
      //folders at the end
      //this is critically important so that the top level of files are read before any other files with the same names can be read
      //E.g.
      // vault/test is read before vault/folder/test
      //if "test" is used as a link, we now we can safely use the first pathName that appeared
      .sort((a, b) => Number(a.isDirectory()) - Number(b.isDirectory()))
  );
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
  const dirents = readFilteredAndSortedDir(context, dir);
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
    context.adapter.appendToResultFile(
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
    context.adapter.appendToResultFile(
      targetPath,
      `]
    }`,
    );
    if (childrenPosition !== ChildrenPosition.LAST) {
      context.adapter.appendToResultFile(targetPath, ',');
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
      await context.adapter.readFile(file),
      context,
      today,
    );
    context.adapter.appendToResultFile(targetPath, JSON.stringify(fileNode, null, 2));
    if (childrenPosition !== ChildrenPosition.LAST) {
      context.adapter.appendToResultFile(targetPath, ',');
    }
  };
}
