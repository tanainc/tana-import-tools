/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from 'vitest';
import { getAllInvalidLinks } from '../links/invalidLinks';
import { untrackedUidRequest } from '../links/genericLinks';
import { createVaultContext } from '../VaultContext';
import { deterministicGenerator } from './testUtils';
import { requestUidForLink, requestUidForContentNode, requestUidForFile } from '../links/internalLinks';
import { CustomFileSystemAdapter } from '../filesystem/CustomFileSystemAdapter';

const dummyAdapter: CustomFileSystemAdapter = { resolve: (str: string) => str } as any;

test('VaultContext uid test', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForLink('link', context)).toBe('0');
  //no change on second call
  expect(requestUidForLink('link', context)).toBe('0');
  expect(context.summary).toEqual({
    leafNodes: 1,
    topLevelNodes: 0,
    totalNodes: 1,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  });
  //folders get different UIDs
  expect(untrackedUidRequest(context)).toBe('1');
  expect(context.summary).toEqual({
    leafNodes: 2,
    topLevelNodes: 0,
    totalNodes: 2,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  });
  //folders always have fresh UIDs, so folders with the same name work
  expect(untrackedUidRequest(context)).toBe('2');
  //having folder UIDs does not change other UIDs
  expect(requestUidForLink('link', context)).toBe('0');
});

test('VaultContext file links: top level and mixed are unchanged', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForFile('fileName', 'fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('1');
  expect(requestUidForFile('fileName', 'filePath/fileName2', context)).toBe('2');

  expect(requestUidForFile('fileName', 'fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('1');
  expect(requestUidForFile('fileName', 'filePath/fileName2', context)).toBe('2');
});

test('VaultContext file links: top level and mixed order does matter', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  //this case should never happen, because we always read top level files first
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('0');
  //but if this would happen, we would misclassify this request
  expect(requestUidForLink('fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'fileName', context)).toBe('1');
  //and then correctly classify it once the top level file is read
  expect(requestUidForLink('fileName', context)).toBe('1');
  expect(requestUidForFile('fileName', 'filePath/fileName2', context)).toBe('2');
  expect(requestUidForLink('fileName', context)).toBe('1');
});

test('VaultContext file links: link is detected first', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForLink('fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'fileName', context)).toBe('0');
});

test('VaultContext nested file links link is detected first', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForLink('filePath/fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('0');
});

test('VaultContext same filename test: files are handled first', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForFile('fileName', 'fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('1');
  expect(requestUidForLink('fileName', context)).toBe('0');
  expect(requestUidForLink('filePath/fileName', context)).toBe('1');
});

test('VaultContext same filename test: files are handled after', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForLink('filePath/fileName', context)).toBe('0');
  expect(requestUidForLink('fileName', context)).toBe('1');
  expect(requestUidForFile('fileName', 'fileName', context)).toBe('1');
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('0');
});

test('VaultContext same filename test: files are handled mixed', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  expect(requestUidForLink('filePath/fileName', context)).toBe('0');
  expect(requestUidForFile('fileName', 'fileName', context)).toBe('1');
  expect(requestUidForLink('fileName', context)).toBe('1');
  expect(requestUidForFile('fileName', 'filePath/fileName', context)).toBe('0');
});

test('VaultContext uid block link test', () => {
  //first reading the file, then encountering the block ref
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  const [uid, content] = requestUidForContentNode('fileName', 'filePath', 'content ^uid', context);
  expect(uid).toBe('0');
  expect(content).toBe('content');
  const uid2 = requestUidForLink('fileName#^uid', context);
  expect(uid2).toBe('0');

  //first encountering the block ref, then reading the file
  const uid3 = requestUidForLink('fileName#^uid3', context);
  expect(uid3).toBe('1');
  const [uid4, content2] = requestUidForContentNode('fileName', 'filePath', 'content ^uid3', context);
  expect(uid4).toBe('1');
  expect(content2).toBe('content');

  //different file
  const uid5 = requestUidForLink('fileName2#^uid3', context);
  expect(uid5).toBe('2');
  const [uid6, content3] = requestUidForContentNode('fileName2', 'filePath2', 'content ^uid3', context);
  expect(uid6).toBe('2');
  expect(content3).toBe('content');
});

test('VaultContext invalid nodes test', () => {
  const context = createVaultContext('', dummyAdapter, deterministicGenerator());
  //the block link has not been accessed from its source / has not been found - just used
  requestUidForLink('fileName#^uid', context);
  expect(getAllInvalidLinks(context)).toStrictEqual([{ uid: '0', link: 'fileName#^uid' }]);
});
