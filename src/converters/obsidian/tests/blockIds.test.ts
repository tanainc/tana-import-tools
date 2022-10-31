import { expect, test } from 'vitest';
import { removeBlockId } from '../markdown/blockIds';

test('blockId removal test', () => {
  expect(removeBlockId('')).toStrictEqual(['', undefined]);
  expect(removeBlockId('^ID')).toStrictEqual(['', '^ID']);
  expect(removeBlockId('\n^ID')).toStrictEqual(['\n', '^ID']);
  expect(removeBlockId('Test::\n^ID')).toStrictEqual(['Test::\n', '^ID']);
});
