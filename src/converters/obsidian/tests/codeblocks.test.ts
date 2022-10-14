import { expect, test } from 'vitest';
import { detectCodeBlockHierarchy, postProcessCodeBlock } from '../hierarchy/codeblocks';
import { HierarchyType } from '../hierarchy/markdownNodes';

test('codeblocks hierarchy test', () => {
  const noCodeBlock = [
    '',
    ' ',
    '\n',
    ' \n',
    '\n ',
    '# heading\nparagraph\n',
    '``` illegal\n```',
    '```\n```illegal',
    '```\n``` illegal',
    '```Clojure is cool\n```',
  ];
  noCodeBlock.forEach((s) => {
    expect(detectCodeBlockHierarchy(s, 0)).toStrictEqual(null);
  });
  expect(detectCodeBlockHierarchy('```\n```', 0)).toStrictEqual({
    codeLanguage: undefined,
    level: '```\n```'.length,
    type: HierarchyType.CODEBLOCK,
  });
  expect(detectCodeBlockHierarchy('```\n```\n', 0)).toStrictEqual({
    codeLanguage: undefined,
    level: '```\n```\n'.length,
    type: HierarchyType.CODEBLOCK,
  });
  expect(detectCodeBlockHierarchy('```\n```\nAnything', 0)).toStrictEqual({
    codeLanguage: undefined,
    level: '```\n```\n'.length,
    type: HierarchyType.CODEBLOCK,
  });
  expect(detectCodeBlockHierarchy('\n```\n```\nAnything', 1)).toStrictEqual({
    codeLanguage: undefined,
    level: '```\n```\n'.length,
    type: HierarchyType.CODEBLOCK,
  });
  expect(detectCodeBlockHierarchy('```\n```', 0)).toStrictEqual({
    codeLanguage: undefined,
    level: '```\n```'.length,
    type: HierarchyType.CODEBLOCK,
  });
  expect(detectCodeBlockHierarchy('```codeLanguage\n```', 0)).toStrictEqual({
    codeLanguage: 'codeLanguage',
    level: '```codeLanguage\n```'.length,
    type: HierarchyType.CODEBLOCK,
  });
  expect(detectCodeBlockHierarchy('```codeLanguage\n(fn (destroy))```\n', 0)).toStrictEqual({
    codeLanguage: 'codeLanguage',
    level: '```codeLanguage\n(fn (destroy))```\n'.length,
    type: HierarchyType.CODEBLOCK,
  });
});

test('codeblocks post processing test', () => {
  expect(
    postProcessCodeBlock({
      type: HierarchyType.CODEBLOCK,
      content: '```codeLanguage\n(fn (destroy))```\n',
      level: 0,
      codeLanguage: 'codeLanguage',
    }),
  ).toEqual('(fn (destroy))');
  expect(
    postProcessCodeBlock({
      type: HierarchyType.CODEBLOCK,
      content: '```codeLanguage\n(fn (destroy))```',
      level: 0,
      codeLanguage: 'codeLanguage',
    }),
  ).toEqual('(fn (destroy))');
  //keeping empty lines inside the code, could have meaning
  expect(
    postProcessCodeBlock({
      type: HierarchyType.CODEBLOCK,
      content: '```codeLanguage\n\n(fn (destroy))```',
      level: 0,
      codeLanguage: 'codeLanguage',
    }),
  ).toEqual('\n(fn (destroy))');
});
