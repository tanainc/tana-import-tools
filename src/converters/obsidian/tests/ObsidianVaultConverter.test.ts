import { expect, test } from 'vitest';
import { readFileSync, unlinkSync } from 'fs';
import { LocalFileSystemAdapter } from '../filesystem/LocalFileSystemAdapter';
import { ObsidianVaultConverter } from '../ObsidianVaultConverter';
import { createVaultContext } from '../VaultContext';
import { deterministicGenerator } from './testUtils';

test('obsidian vault converter', async () => {
  const context = createVaultContext(
    './src/converters/obsidian/tests/fixtures/vault',
    new LocalFileSystemAdapter(),
    deterministicGenerator(),
  );
  await ObsidianVaultConverter(context, 1);
  const result = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/vault.tif.json', 'utf-8'));
  // console.log(JSON.stringify(result));
  unlinkSync('./src/converters/obsidian/tests/fixtures/vault.tif.json');
  const expected = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/full.tif.json', 'utf-8'));
  expect(result).toStrictEqual(expected);
  expect(context.dailyNoteFormat).toBe('DD-MM-YYYY');
});
