import { expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { HierarchyType, fileContentToNodes } from '../obsidianNodes';

test('headings', () => {
  expect(fileContentToNodes('## Heading ')).toStrictEqual([
    { content: 'Heading', level: 2, type: HierarchyType.HEADING },
  ]);
  expect(fileContentToNodes('## Heading\n')).toStrictEqual([
    { content: 'Heading', level: 2, type: HierarchyType.HEADING },
  ]);
  expect(fileContentToNodes('## Heading\n\n')).toStrictEqual([
    { content: 'Heading', level: 2, type: HierarchyType.HEADING },
  ]);
});

test('paragraphs', () => {
  expect(fileContentToNodes('Starting without heading. ')).toStrictEqual([
    { content: 'Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(fileContentToNodes(' Starting without heading.')).toStrictEqual([
    { content: 'Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(fileContentToNodes('Starting without heading.\n')).toStrictEqual([
    { content: 'Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(fileContentToNodes('Starting without heading.\n\n')).toStrictEqual([
    { content: 'Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(fileContentToNodes('Directly followed by hierachy.\n# Heading')).toStrictEqual([
    { content: 'Directly followed by hierachy.', level: 0, type: HierarchyType.PARAGRAPH },
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
  ]);
  expect(fileContentToNodes('# Heading\nPrefixed by hierachy.')).toStrictEqual([
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
    { content: 'Prefixed by hierachy.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(fileContentToNodes('# Heading\n\nPrefixed by hierachy.')).toStrictEqual([
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
    { content: 'Prefixed by hierachy.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(fileContentToNodes('Stuff but with\na newline.\n\n')).toStrictEqual([
    { content: 'Stuff but with\na newline.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
});

test('outliner nodes', () => {
  expect(fileContentToNodes('- Node')).toStrictEqual([{ content: 'Node', level: 0, type: HierarchyType.OUTLINE }]);
  expect(fileContentToNodes(' - Node')).toStrictEqual([{ content: 'Node', level: 1, type: HierarchyType.OUTLINE }]);
  expect(
    fileContentToNodes(`* Text
  * Foo
  * Bar`),
  ).toStrictEqual([
    {
      content: 'Text',
      level: 0,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Foo',
      level: 2,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Bar',
      level: 2,
      type: HierarchyType.OUTLINE,
    },
  ]);
  expect(
    fileContentToNodes(
      `- Some
    - Node
  - Fun`,
    ),
  ).toStrictEqual([
    {
      content: 'Some',
      level: 0,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Node',
      level: 4,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Fun',
      level: 2,
      type: HierarchyType.OUTLINE,
    },
  ]);
  expect(
    fileContentToNodes(
      `- Node with multi lines work.
  As long as the empty space is equivalent.
  How many you like.`,
    ),
  ).toStrictEqual([
    {
      content: `Node with multi lines work.
  As long as the empty space is equivalent.
  How many you like.`,
      level: 0,
      type: HierarchyType.OUTLINE,
    },
  ]);
});

test('mixed nodes', () => {
  expect(
    fileContentToNodes(readFileSync('./src/converters/obsidian/tests/fixtures/vault/test.md', 'utf-8')),
  ).toStrictEqual([
    {
      content: 'Starting without [[heading]].',
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
    {
      content: 'Heading here',
      level: 1,
      type: HierarchyType.HEADING,
    },
    {
      content: '[[Some]]',
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
    {
      content: 'Stuff but with\na newline.',
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
    {
      content: 'Heading 2',
      level: 2,
      type: HierarchyType.HEADING,
    },
    {
      content: 'Some',
      level: 0,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Node with [[Link]] [[Link2]]',
      level: 4,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Fun',
      level: 2,
      type: HierarchyType.OUTLINE,
    },
    {
      content: 'Out of Level',
      level: 4,
      type: HierarchyType.HEADING,
    },
  ]);
});
