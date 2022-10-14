import { expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { WebObsidianVaultConverter } from '../WebObsidianVaultConverter';
import { deterministicGenerator } from './testUtils';

test('web obsidian vault converter', async () => {
  const blob = new Blob([readFileSync('./src/converters/obsidian/tests/fixtures/vault.zip')]);
  const [, context, adapter] = await WebObsidianVaultConverter(blob, 'vault', 1, deterministicGenerator());
  const result = JSON.parse(adapter.getResult());
  // console.log(JSON.stringify(result));
  const expected = JSON.parse(readFileSync('./src/converters/obsidian/tests/fixtures/full.tif.json', 'utf-8'));
  expect(result).toStrictEqual(expected);
  expect(context.dailyNoteFormat).toBe('DD-MM-YYYY');
});
