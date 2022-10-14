/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from '@jest/globals';
import { getAllInvalidLinks } from '../links/invalidLinks';
import { untrackedUidRequest } from '../links/genericLinks';
import { createVaultContext } from '../VaultContext';
import { deterministicGenerator } from './testUtils';
import { requestUidForLink, requestUidForContentNode } from '../links/internalLinks';

test('VaultContext uid test', () => {
  const context = createVaultContext('', null as any, deterministicGenerator());
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

test('VaultContext uid block link test', () => {
  //first reading the file, then encountering the block ref
  const context = createVaultContext('', null as any, deterministicGenerator());
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
  const context = createVaultContext('', null as any, deterministicGenerator());
  //the block link has not been accessed from its source / has not been found - just used
  requestUidForLink('fileName#^uid', context);
  expect(getAllInvalidLinks(context)).toStrictEqual([{ uid: '0', link: 'fileName#^uid' }]);
});
