import { expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { convertObsidianFile } from '../fileConverter';
import { convertVault } from '../vaultConverter';

test('obsidian file converter', () => {
  const fileContent = readFileSync('./src/converters/obsidian/tests/fixtures/vault/test.md', 'utf-8');
  convertVault('./src/converters/obsidian/tests/fixtures/vault');
});
