import { expect, test } from 'vitest';
import { readFileSync, unlinkSync } from 'fs';
import { LocalObsidianZipVaultConverter } from '../LocalObsidianZipVaultConverter';
import { deterministicGenerator } from './testUtils';

test('local obsidian zip vault converter', async () => {
  const [, context] = await LocalObsidianZipVaultConverter(
    './src/converters/obsidian/tests/fixtures/vault.zip',
    1,
    deterministicGenerator(),
  );
  const result = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/vault.tif.json', 'utf-8'));
  // console.log(JSON.stringify(result));
  unlinkSync('./src/converters/obsidian/tests/fixtures/vault.tif.json');
  const expected = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/full.tif.json', 'utf-8'));
  expect(result).toStrictEqual(expected);
  expect(context.dailyNoteFormat).toBe('DD-MM-YYYY');
});
