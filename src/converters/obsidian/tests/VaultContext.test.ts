import { expect, test } from '@jest/globals';
import { UidRequestType, VaultContext } from '../VaultContext';
import { deterministicGenerator } from './testUtils';

test('VaultContext uid test', () => {
  const vaultContext = new VaultContext(deterministicGenerator());
  expect(vaultContext.uidRequest('link', UidRequestType.CONTENT)).toBe('0');
  //no change on second call
  expect(vaultContext.uidRequest('link', UidRequestType.CONTENT)).toBe('0');
  expect(vaultContext.summary).toEqual({
    leafNodes: 1,
    topLevelNodes: 0,
    totalNodes: 1,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  });
  //folders get different uids
  expect(vaultContext.randomUid()).toBe('1');
  expect(vaultContext.summary).toEqual({
    leafNodes: 2,
    topLevelNodes: 0,
    totalNodes: 2,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  });
  //folders always have fresh uids, so folders with the same name work
  expect(vaultContext.randomUid()).toBe('2');
  //having folder uids does not change other uids
  expect(vaultContext.uidRequest('link', UidRequestType.CONTENT)).toBe('0');
});

test('VaultContext uid block link test', () => {
  //first reading the file, then encountering the block ref
  const vaultContext = new VaultContext(deterministicGenerator());
  const [uid, content] = vaultContext.contentUid('fileName', 'content ^uid');
  expect(uid).toBe('0');
  expect(content).toBe('content');
  const uid2 = vaultContext.uidRequest('fileName#^uid', UidRequestType.CONTENT);
  expect(uid2).toBe('0');

  //first encountering the block ref, then reading the file
  const uid3 = vaultContext.uidRequest('fileName#^uid3', UidRequestType.CONTENT);
  expect(uid3).toBe('1');
  const [uid4, content2] = vaultContext.contentUid('fileName', 'content ^uid3');
  expect(uid4).toBe('1');
  expect(content2).toBe('content');

  //different file
  const uid5 = vaultContext.uidRequest('fileName2#^uid3', UidRequestType.CONTENT);
  expect(uid5).toBe('2');
  const [uid6, content3] = vaultContext.contentUid('fileName2', 'content ^uid3');
  expect(uid6).toBe('2');
  expect(content3).toBe('content');
});

test('VaultContext invalid nodes test', () => {
  const vaultContext = new VaultContext(deterministicGenerator());
  //the block link has not been accessed from its source / has not been found - just used
  vaultContext.uidRequest('fileName#^uid', UidRequestType.CONTENT);
  expect(vaultContext.getAllInvalidContentLinks()).toStrictEqual([{ uid: '0', link: 'fileName#^uid' }]);
});
