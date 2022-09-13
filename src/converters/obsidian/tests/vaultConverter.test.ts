import { expect, test } from '@jest/globals';
import { readFileSync, unlinkSync } from 'fs';
import { convertVault } from '../vaultConverter';

test('obsidian vault converter', () => {
  convertVault('./src/converters/obsidian/tests/fixtures/vault', 1, () => 'uid');
  const result = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/vault.tif.json', 'utf-8'));
  unlinkSync('./src/converters/obsidian/tests/fixtures/vault.tif.json');
  const expected = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/test.tif.json', 'utf-8'));
  expect(result).toStrictEqual(expected);
});
