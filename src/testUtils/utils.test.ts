import { expect, test } from 'vitest';
import { findGroups, getBracketLinks, isIndexWithinBackticks, replaceTokenWithHtml } from '../utils/utils.js';

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
