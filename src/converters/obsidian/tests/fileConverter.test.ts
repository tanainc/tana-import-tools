import { expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { convertObsidianFile } from '../fileConverter';

test('obsidian file converter', () => {
  const fileContent = readFileSync('./src/converters/obsidian/tests/fixtures/vault/test.md', 'utf-8');
  const result = convertObsidianFile('test', fileContent, undefined, 1, () => 'uid');

  expect(result).toStrictEqual([
    {
      createdAt: 1,
      editedAt: 1,
      name: '',
      type: 'node',
      uid: 'test',
      children: [
        {
          createdAt: 1,
          editedAt: 1,
          name: 'Starting without [[heading]].',
          refs: ['heading'],
          type: 'node',
          uid: 'uid',
        },
        {
          children: [
            { createdAt: 1, editedAt: 1, name: '[[Some]]', refs: ['Some'], type: 'node', uid: 'uid' },
            { createdAt: 1, editedAt: 1, name: 'Stuff but with\na newline.', type: 'node', uid: 'uid' },
            {
              children: [
                {
                  children: [
                    {
                      createdAt: 1,
                      editedAt: 1,
                      name: '    - Node with [[Link]] [[Link2]]',
                      refs: ['Link', 'Link2'],
                      type: 'node',
                      uid: 'uid',
                    },
                    { createdAt: 1, editedAt: 1, name: '  - Fun', type: 'node', uid: 'uid' },
                  ],
                  createdAt: 1,
                  editedAt: 1,
                  name: '- Some',
                  type: 'node',
                  uid: 'uid',
                },
                { createdAt: 1, editedAt: 1, name: '#### Out of Level', type: 'node', uid: 'uid' },
              ],
              createdAt: 1,
              editedAt: 1,
              name: '## Heading 2',
              type: 'node',
              uid: 'uid',
            },
          ],
          createdAt: 1,
          editedAt: 1,
          name: '# Heading here',
          type: 'node',
          uid: 'uid',
        },
      ],
    },
    { brokenRefs: 0, calendarNodes: 0, fields: 0, leafNodes: 9, topLevelNodes: 1, totalNodes: 10 },
  ]);
});
