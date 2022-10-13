import { expect, test } from '@jest/globals';
import { getAllInvalidLinks } from '../tanaconversion/invalidLinks';
import { contentUidRequest, untrackedUidRequest, uidRequest, UidRequestType } from '../tanaconversion/uids';
import { createVaultContext } from '../context';
import { deterministicGenerator } from './testUtils';

test('VaultContext uid test', () => {
  const context = createVaultContext('', deterministicGenerator());
  expect(uidRequest('link', UidRequestType.CONTENT, context)).toBe('0');
  //no change on second call
  expect(uidRequest('link', UidRequestType.CONTENT, context)).toBe('0');
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
  expect(uidRequest('link', UidRequestType.CONTENT, context)).toBe('0');
});

test('VaultContext uid block link test', () => {
  //first reading the file, then encountering the block ref
  const context = createVaultContext('', deterministicGenerator());
  const [uid, content] = contentUidRequest('fileName', 'content ^uid', context);
  expect(uid).toBe('0');
  expect(content).toBe('content');
  const uid2 = uidRequest('fileName#^uid', UidRequestType.CONTENT, context);
  expect(uid2).toBe('0');

  //first encountering the block ref, then reading the file
  const uid3 = uidRequest('fileName#^uid3', UidRequestType.CONTENT, context);
  expect(uid3).toBe('1');
  const [uid4, content2] = contentUidRequest('fileName', 'content ^uid3', context);
  expect(uid4).toBe('1');
  expect(content2).toBe('content');

  //different file
  const uid5 = uidRequest('fileName2#^uid3', UidRequestType.CONTENT, context);
  expect(uid5).toBe('2');
  const [uid6, content3] = contentUidRequest('fileName2', 'content ^uid3', context);
  expect(uid6).toBe('2');
  expect(content3).toBe('content');
});

test('VaultContext invalid nodes test', () => {
  const context = createVaultContext('', deterministicGenerator());
  //the block link has not been accessed from its source / has not been found - just used
  uidRequest('fileName#^uid', UidRequestType.CONTENT, context);
  expect(getAllInvalidLinks(context)).toStrictEqual([{ uid: '0', link: 'fileName#^uid' }]);
});
