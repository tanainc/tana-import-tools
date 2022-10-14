import { expect, test } from 'vitest';
import { countEmptySpace } from '../markdown/emptySpace';
import { extractMarkdownNodes, HierarchyType } from '../hierarchy/markdownNodes';
import { nextNewLine } from '../markdown/newline';

test('headings', () => {
  expect(extractMarkdownNodes('# Heading')).toStrictEqual([
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
  ]);
  expect(extractMarkdownNodes('## Heading')).toStrictEqual([
    { content: 'Heading', level: 2, type: HierarchyType.HEADING },
  ]);
  expect(extractMarkdownNodes('## Heading\n')).toStrictEqual([
    { content: 'Heading', level: 2, type: HierarchyType.HEADING },
  ]);
  expect(extractMarkdownNodes('## Heading\n\n')).toStrictEqual([
    { content: 'Heading', level: 2, type: HierarchyType.HEADING },
  ]);
});

test('paragraphs', () => {
  expect(extractMarkdownNodes(' Starting without heading.')).toStrictEqual([
    { content: ' Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(extractMarkdownNodes('Starting without heading.\n')).toStrictEqual([
    { content: 'Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(extractMarkdownNodes('Starting without heading.\n\n')).toStrictEqual([
    { content: 'Starting without heading.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(extractMarkdownNodes('Directly followed by hierarchy.\n# Heading')).toStrictEqual([
    { content: 'Directly followed by hierarchy.', level: 0, type: HierarchyType.PARAGRAPH },
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
  ]);
  expect(extractMarkdownNodes('# Heading\nPrefixed by hierarchy.')).toStrictEqual([
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
    { content: 'Prefixed by hierarchy.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(extractMarkdownNodes('# Heading\n\nPrefixed by hierarchy.')).toStrictEqual([
    { content: 'Heading', level: 1, type: HierarchyType.HEADING },
    { content: 'Prefixed by hierarchy.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(extractMarkdownNodes('Stuff but with\na newline.\n\n')).toStrictEqual([
    { content: 'Stuff but with\na newline.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  //TODO: will change again when we do something sensible with the block quotes
  expect(extractMarkdownNodes('Stuff but with\n> a blockquote.\n\n')).toStrictEqual([
    { content: 'Stuff but with\n> a blockquote.', level: 0, type: HierarchyType.PARAGRAPH },
    // { content: '> a blockquote.', level: 0, type: HierarchyType.PARAGRAPH },
  ]);
  expect(extractMarkdownNodes('---\nFoo `paragraph-run-style-emphasis-flip.docx` bar')).toStrictEqual([
    {
      content: '---\nFoo `paragraph-run-style-emphasis-flip.docx` bar',
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
  ]);

  expect(
    extractMarkdownNodes(`Read this:
https://mek.fyi/posts/why-books-work-and-could-work-better
  Interesting:
    ![[Screen Shot 2020-08-07 at 07.00.18.png]]
    Foo
      Bar
      ![[Screen Shot 2020-08-01 at 07.35.47.png]]`),
  ).toStrictEqual([
    {
      content: `Read this:
https://mek.fyi/posts/why-books-work-and-could-work-better
  Interesting:
    ![[Screen Shot 2020-08-07 at 07.00.18.png]]
    Foo
      Bar
      ![[Screen Shot 2020-08-01 at 07.35.47.png]]`,
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
  ]);

  //can deal with *-s not being bullet nodes
  expect(
    extractMarkdownNodes(`---
On first glance, the expected result seems wrong to me. Looking at the \`paragraph-run-style-emphasis-flip.docx\` test document's XML markup and rendering in Microsoft Word (v15.29), I would expect a **nested** emphasis, not a **"breaking out"** of the outer emphasis:`),
  ).toStrictEqual([
    {
      content: `---
On first glance, the expected result seems wrong to me. Looking at the \`paragraph-run-style-emphasis-flip.docx\` test document's XML markup and rendering in Microsoft Word (v15.29), I would expect a **nested** emphasis, not a **"breaking out"** of the outer emphasis:`,
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
  ]);

  //tables are extracted as PARAGRAPH
  expect(
    extractMarkdownNodes(`
| Foo | Bar |
| --- | --- |
| foo | bar |
| foo | bar |`),
  ).toStrictEqual([
    {
      content: `| Foo | Bar |
| --- | --- |
| foo | bar |
| foo | bar |`,
      level: 0,
      type: HierarchyType.PARAGRAPH,
    },
  ]);
});

test('bullet nodes', () => {
  expect(extractMarkdownNodes('- Node')).toStrictEqual([{ content: 'Node', level: 0, type: HierarchyType.BULLET }]);
  //tab
  expect(extractMarkdownNodes(' - Node')).toStrictEqual([{ content: 'Node', level: 1, type: HierarchyType.BULLET }]);
  //space
  expect(extractMarkdownNodes(' - Node')).toStrictEqual([{ content: 'Node', level: 1, type: HierarchyType.BULLET }]);
  expect(extractMarkdownNodes(' 1. Node')).toStrictEqual([
    { content: '1. Node', level: 1, type: HierarchyType.BULLET },
  ]);
  expect(extractMarkdownNodes(' 1) Node')).toStrictEqual([
    { content: '1) Node', level: 1, type: HierarchyType.BULLET },
  ]);
  expect(
    extractMarkdownNodes(`* Text
  * Foo
  * Bar`),
  ).toStrictEqual([
    {
      content: 'Text',
      level: 0,
      type: HierarchyType.BULLET,
    },
    {
      content: 'Foo',
      level: 2,
      type: HierarchyType.BULLET,
    },
    {
      content: 'Bar',
      level: 2,
      type: HierarchyType.BULLET,
    },
  ]);
  expect(
    extractMarkdownNodes(
      `- Some
    - Node
  - Fun`,
    ),
  ).toStrictEqual([
    {
      content: 'Some',
      level: 0,
      type: HierarchyType.BULLET,
    },
    {
      content: 'Node',
      level: 4,
      type: HierarchyType.BULLET,
    },
    {
      content: 'Fun',
      level: 2,
      type: HierarchyType.BULLET,
    },
  ]);
  expect(
    extractMarkdownNodes(
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
      type: HierarchyType.BULLET,
    },
  ]);
});

test('mixed nodes', () => {
  expect(
    extractMarkdownNodes(`## A list
https://some.url/
1. Much more foo.
2. Take modern bar. 
3. Baz.
4. etc. `),
  ).toStrictEqual([
    { content: 'A list', level: 2, type: HierarchyType.HEADING },
    { content: 'https://some.url/', level: 0, type: HierarchyType.PARAGRAPH },
    {
      content: '1. Much more foo.',
      level: 0,
      type: HierarchyType.BULLET,
    },
    {
      content: '2. Take modern bar.',
      level: 0,
      type: HierarchyType.BULLET,
    },
    {
      content: '3. Baz.',
      level: 0,
      type: HierarchyType.BULLET,
    },
    {
      content: '4. etc.',
      level: 0,
      type: HierarchyType.BULLET,
    },
  ]);
});
test('empty space util', () => {
  expect(countEmptySpace('a   b c', 1)).toBe(3);
  expect(countEmptySpace('a   b c', 5)).toBe(1);
});

test('next newline util', () => {
  expect(nextNewLine('\nfoo bar foobar', 2)).toBe('\nfoo bar foobar'.length);
  expect(nextNewLine('foo \n\n bar', 2)).toBe(4);
});
