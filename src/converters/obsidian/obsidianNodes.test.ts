import { expect, test } from '@jest/globals';
import { readNodes } from './obsidianNodes';
import { HierarchyType } from './obsidianNodes.types';

test('headings', () => {
  expect(readNodes('## Heading')).toStrictEqual([
    { content: '## Heading', endPos: 9, level: 2, startPos: 0, type: HierarchyType.HEADING },
  ]);
  expect(readNodes('## Heading\n')).toStrictEqual([
    { content: '## Heading', endPos: 9, level: 2, startPos: 0, type: HierarchyType.HEADING },
  ]);
  expect(readNodes('## Heading\n\n')).toStrictEqual([
    { content: '## Heading', endPos: 9, level: 2, startPos: 0, type: HierarchyType.HEADING },
  ]);
});

test('paragraphs', () => {
  expect(readNodes('Starting without heading.')).toStrictEqual([
    { content: 'Starting without heading.', endPos: 24, level: 0, startPos: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(readNodes('Starting without heading.\n')).toStrictEqual([
    { content: 'Starting without heading.', endPos: 24, level: 0, startPos: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(readNodes('Starting without heading.\n\n')).toStrictEqual([
    { content: 'Starting without heading.', endPos: 24, level: 0, startPos: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(readNodes('Directly followed by hierachy.\n# Heading')).toStrictEqual([
    { content: 'Directly followed by hierachy.', endPos: 29, level: 0, startPos: 0, type: HierarchyType.PARAGRAPH },
    { content: '# Heading', endPos: 39, level: 1, startPos: 31, type: HierarchyType.HEADING },
  ]);
  expect(readNodes('# Heading\nPrefixed by hierachy.')).toStrictEqual([
    { content: '# Heading', endPos: 8, level: 1, startPos: 0, type: HierarchyType.HEADING },
    { content: 'Prefixed by hierachy.', endPos: 30, level: 0, startPos: 10, type: HierarchyType.PARAGRAPH },
  ]);
  expect(readNodes('# Heading\n\nPrefixed by hierachy.')).toStrictEqual([
    { content: '# Heading', endPos: 8, level: 1, startPos: 0, type: HierarchyType.HEADING },
    { content: 'Prefixed by hierachy.', endPos: 31, level: 0, startPos: 11, type: HierarchyType.PARAGRAPH },
  ]);
});

test('outliner nodes', () => {
  expect(
    readNodes(
      `- Some
    - Node
  - Fun`,
    ),
  ).toStrictEqual([
    {
      content: '- Some',
      endPos: 5,
      level: 0,
      startPos: 0,
      type: HierarchyType.OUTLINE,
    },
    {
      content: '    - Node',
      endPos: 16,
      level: 4,
      startPos: 7,
      type: HierarchyType.OUTLINE,
    },
    {
      content: '  - Fun',
      endPos: 24,
      level: 2,
      startPos: 18,
      type: HierarchyType.OUTLINE,
    },
  ]);
  expect(
    readNodes(
      `- Node with multi lines work.
  As long as the empty space is equivalent.
  How many you like.`,
    ),
  ).toStrictEqual([
    {
      content: `- Node with multi lines work.
  As long as the empty space is equivalent.
  How many you like.`,
      endPos: 93,
      level: 0,
      startPos: 0,
      type: HierarchyType.OUTLINE,
    },
  ]);
});
