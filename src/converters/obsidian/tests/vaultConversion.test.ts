/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test } from 'vitest';
import { CustomFileSystemEntry } from '../filesystem/CustomFileSystemAdapter';
import { ChildrenPosition, handleVault } from '../tanaconversion/vaultConversion';
import { VaultContext } from '../VaultContext';

const makeDirEnt = ([str, isDir]: [string, boolean]): CustomFileSystemEntry => {
  return { getName: () => str, isDirectory: () => isDir };
};

test('vaultConversion file filter test', async () => {
  // GIVEN
  const order: string[] = [];
  const handleDirStart = (dir: string) => {
    order.push(dir);
  };
  const handleFile = (file: string, pos: ChildrenPosition) => {
    order.push(file);
    return Promise.resolve();
  };
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleDirEnd = (children: ChildrenPosition) => {};

  const dirContent = [
    [
      ['file1.md', false],
      ['folder1', true],
      ['file2.md', false],
      ['NOT_MD', false],
      ['.obsidian', true],
      ['file3.md', false],
      ['folder2', true],
      ['.github', true],
    ].map((e) => makeDirEnt(e as [string, boolean])),
    [['file4.md', false]].map((e) => makeDirEnt(e as [string, boolean])),
    [],
  ].reverse();

  const readDirectory = (dir: string) => dirContent.pop();
  // WHEN
  await handleVault({ adapter: { readDirectory } } as VaultContext, 'vault', handleDirStart, handleDirEnd, handleFile);
  // THEN
  // folders have been filtered out and the rest of the folders have been sorted to the back
  expect(order).toStrictEqual(['vault', 'file1.md', 'file2.md', 'file3.md', 'folder1', 'file4.md', 'folder2']);
});
