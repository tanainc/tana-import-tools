import { expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { ObsidianSingleFileConverter } from '../ObsidianSingleFileConverter';
import { VaultContext } from '../VaultContext';
import { deterministicGenerator } from './testUtils';

test('obsidian file converter', () => {
  const vaultContext = new VaultContext(deterministicGenerator());
  const result = ObsidianSingleFileConverter(
    './src/converters/obsidian/tests/fixtures/vault/test.md',
    readFileSync('./src/converters/obsidian/tests/fixtures/vault/test.md', 'utf-8'),
    1,
    vaultContext,
  );
  const expected = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/single.tif.json', 'utf-8'));
  expect(result).toStrictEqual(expected);
});
