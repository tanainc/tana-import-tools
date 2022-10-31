import { expect, test } from 'vitest';
import { removeBlockId } from '../markdown/blockIds';

test('blockId removal test', () => {
  expect(removeBlockId('')).toStrictEqual(['', undefined]);
  expect(removeBlockId('^ID')).toStrictEqual(['', '^ID']);
  expect(removeBlockId('\n^ID')).toStrictEqual(['\n', '^ID']);
  expect(removeBlockId('Test::\n^ID')).toStrictEqual(['Test::\n', '^ID']);
  expect(removeBlockId('Test::\nNOT_ID')).toStrictEqual(['Test::\nNOT_ID', undefined]);
  expect(removeBlockId('Test::\nNOT_ID ^ID')).toStrictEqual(['Test::\nNOT_ID', '^ID']);
  expect(removeBlockId('Test::\nNOT_ID ^ID1\nNOT_ID ^ID2')).toStrictEqual(['Test::\nNOT_ID\nNOT_ID', '^ID2']);
});
