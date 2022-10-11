import { expect, test } from '@jest/globals';
import { readFileSync, unlinkSync } from 'fs';
import { ObsidianVaultConverter } from '../ObsidianVaultConverter';
import { VaultContext } from '../VaultContext';
import { deterministicGenerator } from './testUtils';

test('obsidian vault converter', async () => {
  const vaultContext = new VaultContext('./src/converters/obsidian/tests/fixtures/vault', deterministicGenerator());
  await ObsidianVaultConverter(vaultContext, 1);
  const result = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/vault.tif.json', 'utf-8'));
  // console.log(JSON.stringify(result));
  unlinkSync('./src/converters/obsidian/tests/fixtures/vault.tif.json');
  const expected = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/full.tif.json', 'utf-8'));
  expect(vaultContext.dailyNoteFormat).toBe('DD-MM-YYYY');
  expect(result).toStrictEqual(expected);
});
