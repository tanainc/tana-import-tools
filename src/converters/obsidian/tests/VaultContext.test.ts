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
  expect(vaultContext.uidRequest('link', UidRequestType.FOLDER)).toBe('1');
  expect(vaultContext.summary).toEqual({
    leafNodes: 2,
    topLevelNodes: 0,
    totalNodes: 2,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  });
  //folders always have fresh uids, so folders with the same name work
  expect(vaultContext.uidRequest('link', UidRequestType.FOLDER)).toBe('2');
  //having folder uids does not change other uids
  expect(vaultContext.uidRequest('link', UidRequestType.CONTENT)).toBe('0');
});
