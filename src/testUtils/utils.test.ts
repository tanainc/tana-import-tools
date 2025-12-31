import { expect, test } from 'vitest';
import { findGroups, getBracketLinks, isIndexWithinBackticks, markdownToHTML, replaceTokenWithHtml } from '../utils/utils.js';

test('isIndexWithinBackticks', () => {
  expect(isIndexWithinBackticks(0, '```fooo```')).toBe(false);
  expect(isIndexWithinBackticks(4, '```fooo```')).toBe(true);

  expect(isIndexWithinBackticks(0, '`fooo`')).toBe(false);
  expect(isIndexWithinBackticks(4, '`fooo`')).toBe(true);
});

test('isIndexWithinBackticks', () => {
  expect(isIndexWithinBackticks(0, '```fooo```')).toBe(false);
  expect(isIndexWithinBackticks(4, '```fooo```')).toBe(true);

  expect(isIndexWithinBackticks(0, '`fooo`')).toBe(false);
  expect(isIndexWithinBackticks(4, '`fooo`')).toBe(true);
});

test('findGroups', () => {
  const ape = 'a cool [[ape]] here';
  expect(findGroups(ape, '[[', ']]')).toEqual([{ start: ape.indexOf('[['), end: ape.indexOf(']]'), content: 'ape' }]);

  const imageAlone = '![](https://tana.inc/photo/1)';
  const imageWithContents = 'start ![](https://tana.inc/photo/2) end';
  const multipleImages = 'start ![](https://tana.inc/photo/3) ![](https://tana.inc/photo/4) end';

  expect(findGroups(imageAlone, '![](', ')')).toEqual([
    {
      start: imageAlone.indexOf('![]('),
      end: imageAlone.indexOf(')'),
      content: 'https://tana.inc/photo/1',
    },
  ]);

  expect(findGroups(imageWithContents, '![](', ')')).toEqual([
    {
      start: imageWithContents.indexOf('![]('),
      end: imageWithContents.indexOf(')'),
      content: 'https://tana.inc/photo/2',
    },
  ]);

  expect(findGroups(multipleImages, '![](', ')')).toEqual([
    {
      start: 6,
      end: 34,
      content: 'https://tana.inc/photo/3',
    },
    {
      start: 36,
      end: 64,
      content: 'https://tana.inc/photo/4',
    },
  ]);
});

test('getNestedLinks ', async () => {
  const linkA = '[[Link a here]]';
  const linkB = `[[This is a page with a link to ${linkA}]]`;
  const pageName = `This is a page with a link to ${linkA} and a nested link to ${linkB}`;

  const links = getBracketLinks(pageName, false);
  expect(links).toEqual(['Link a here', 'Link a here', 'This is a page with a link to [[Link a here]]']);

  expect(getBracketLinks(pageName, true)).toEqual(['Link a here', 'This is a page with a link to [[Link a here]]']);

  expect(getBracketLinks('[[foo]] [[foo]]', false)).toEqual(['foo', 'foo']);
  expect(getBracketLinks('[[foo]] [[foo]]', true)).toEqual(['foo', 'foo']);

  expect(getBracketLinks('[[see [[foo]]]] ', false)).toEqual(['foo', 'see [[foo]]']);
  expect(getBracketLinks('[[see [[foo]]]] ', true)).toEqual(['see [[foo]]']);

  expect(getBracketLinks('[[foo]] and [[see [[foo]]]] ', false)).toEqual(['foo', 'foo', 'see [[foo]]']);
  expect(getBracketLinks('[[foo]] and [[see [[foo]]]] ', true)).toEqual(['foo', 'see [[foo]]']);
});

test('replaceTokenWithHtml ', async () => {
  expect(replaceTokenWithHtml('**foo**', '**', 'b')).toEqual('<b>foo</b>');
  expect(replaceTokenWithHtml('**BlÅbÆrSylTeTøY && ÅÆØøæøåö**', '**', 'b')).toEqual(
    '<b>BlÅbÆrSylTeTøY && ÅÆØøæøåö</b>',
  );
  expect(replaceTokenWithHtml('__foo__', '__', 'i')).toEqual('<i>foo</i>');
  expect(replaceTokenWithHtml('__BlÅbÆrSylTeTøY && ÅÆØøæøåö__', '__', 'i')).toEqual(
    '<i>BlÅbÆrSylTeTøY && ÅÆØøæøåö</i>',
  );
  expect(replaceTokenWithHtml('^^foo^^', '^^', 'mark')).toEqual('<mark>foo</mark>');
  expect(replaceTokenWithHtml('^^BlÅbÆrSylTeTøY && ÅÆØøæøåö^^', '^^', 'mark')).toEqual(
    '<mark>BlÅbÆrSylTeTøY && ÅÆØøæøåö</mark>',
  );

  expect(replaceTokenWithHtml('~~foo~~', '~~', 'mark')).toEqual('<mark>foo</mark>');

  expect(replaceTokenWithHtml('^^foo^^ and ^^bar^^ and ending here ^^', '^^', 'mark')).toEqual(
    '<mark>foo</mark> and <mark>bar</mark> and ending here ^^',
  );
});

test.each([
  // Basic markdown links
  ['[text](https://example.com)', '<a href="https://example.com">text</a>'],
  ['[text](https://example.com/path)', '<a href="https://example.com/path">text</a>'],
  ['[text](https://example.com/path/to/page)', '<a href="https://example.com/path/to/page">text</a>'],

  // URLs with balanced parentheses (Wikipedia-style)
  ['[link](https://en.wikipedia.org/wiki/Foo_(bar))', '<a href="https://en.wikipedia.org/wiki/Foo_(bar)">link</a>'],
  ['[wiki](https://en.wikipedia.org/wiki/Test_(disambiguation))', '<a href="https://en.wikipedia.org/wiki/Test_(disambiguation)">wiki</a>'],
  // Note: deeply nested parens like (a(b)c) work, but (a(b(c)d)e) stops early - acceptable tradeoff for ReDoS safety
  ['[nested](https://example.com/a(b(c)d)e)', '<a href="https://example.com/a(b(c)d">nested</a>e)'],

  // File URLs with spaces and parens in path
  ['[file](file:///path/Whereby (1)/doc.md)', '<a href="file:///path/Whereby (1)/doc.md">file</a>'],
  ['[spaces](file:///path/with spaces/file.txt)', '<a href="file:///path/with spaces/file.txt">spaces</a>'],

  // Multiple links
  ['[a](https://a.com) and [b](https://b.com)', '<a href="https://a.com">a</a> and <a href="https://b.com">b</a>'],
  ['before [x](https://x.com) middle [y](https://y.com) after', 'before <a href="https://x.com">x</a> middle <a href="https://y.com">y</a> after'],

  // Non-URL markdown links (should remain unchanged)
  ['[text](not-a-url)', '[text](not-a-url)'],
  ['[text](local-path)', '[text](local-path)'],
  ['[ref](some-anchor)', '[ref](some-anchor)'],

  // Bare URLs
  ['visit https://example.com today', 'visit <a href="https://example.com">https://example.com</a> today'],
  ['https://example.com', '<a href="https://example.com">https://example.com</a>'],

  // Formatting tokens
  ['**bold**', '<b>bold</b>'],
  ['__italic__', '<i>italic</i>'],
  ['^^highlighted^^', '<mark>highlighted</mark>'],
  ['~~strikethrough~~', '<del>strikethrough</del>'],
  ['**bold** and __italic__', '<b>bold</b> and <i>italic</i>'],

  // Trailing whitespace trimming
  ['text\n', 'text'],
  ['text\r', 'text'],
  ['text\t', 'text'],
  ['text\n\n\n', 'text'],

  // Empty/passthrough
  ['', ''],
  ['plain text', 'plain text'],
])('markdownToHTML(%j) => %j', (input, expected) => {
  expect(markdownToHTML(input)).toBe(expected);
});

test('markdownToHTML handles undefined', () => {
  expect(markdownToHTML(undefined as unknown as string)).toBe(undefined);
});

// Malformed links - best-effort parsing
test.each([
  // Missing closing paren at end of string
  ['[text](https://example.com/path', '<a href="https://example.com/path">text</a>'],
  ['[virtual environments](https://realpython.com/python-virtual-environments-a-primer', '<a href="https://realpython.com/python-virtual-environments-a-primer">virtual environments</a>'],
  ['[doc](file:///path/to/doc', '<a href="file:///path/to/doc">doc</a>'],

  // Malformed with text AFTER - fallback only works at end of string/line, so this stays unchanged
  ['[broken](https://example.com/path and more text', '[broken](https://example.com/path and more text'],

  // Malformed with unbalanced parens
  ['[link](https://example.com/foo(bar', '<a href="https://example.com/foo(bar">link</a>'],
])('markdownToHTML malformed: %j => %j', (input, expected) => {
  expect(markdownToHTML(input)).toBe(expected);
});

// ReDoS prevention - these patterns used to hang
test('markdownToHTML does not hang on adversarial input (ReDoS prevention)', () => {
  const adversarialInputs = [
    // Long paths without closing paren
    '[text](https://example.com/very-long-path-without-closing-paren',
    '[text](https://example.com/' + 'a'.repeat(100),
    '[text](https://example.com/' + 'a/'.repeat(50),

    // Many hyphens (common in URLs)
    '[text](https://example.com/python-virtual-environments-a-primer-for-beginners',

    // Mixed parens and long content
    '[text](https://example.com/foo(bar' + 'x'.repeat(100),

    // Multiple unclosed markdown links
    '[a](https://a.com/path [b](https://b.com/path [c](https://c.com/path',

    // Nested brackets (malformed)
    '[outer [inner](https://example.com/path',
  ];

  const start = Date.now();
  for (const input of adversarialInputs) {
    markdownToHTML(input);
  }
  const elapsed = Date.now() - start;

  // All inputs should complete in under 100ms total, not hang
  expect(elapsed).toBeLessThan(100);
});
