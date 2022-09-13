import { expect, test } from '@jest/globals';
import { countEmptySpace, nextNewLine } from '../utils';

test('empty space util', () => {
  expect(countEmptySpace('a   b c', 1)).toBe(3);
  expect(countEmptySpace('a   b c', 5)).toBe(1);
});

test('next newline util', () => {
  expect(nextNewLine('\nfoo bar foobar', 2)).toBe('\nfoo bar foobar'.length);
  expect(nextNewLine('foo \n\n bar', 2)).toBe(4);
});
