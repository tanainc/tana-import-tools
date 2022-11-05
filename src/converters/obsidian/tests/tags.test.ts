import { expect, test } from 'vitest';
import { detectTags, removeTagsFromEnd } from '../markdown/tags';

test('tag detection test', () => {
  expect(detectTags('')).toStrictEqual(undefined);
  expect(detectTags('#tag')).toStrictEqual(['#tag']);
  expect(detectTags(' #tag')).toStrictEqual([' #tag']);
  expect(detectTags(' #inlinetag blub #endtag ')).toStrictEqual([' #inlinetag', ' #endtag']);
});

test('tag removal test', () => {
  expect(removeTagsFromEnd('', detectTags('') ?? [])).toStrictEqual('');
  expect(removeTagsFromEnd('#tag', detectTags('#tag') as string[])).toStrictEqual('');
  expect(removeTagsFromEnd('blub #tag', detectTags('blub #tag ') as string[])).toStrictEqual('blub');
  expect(removeTagsFromEnd('#tag blub', detectTags('#tag blub') as string[])).toStrictEqual('#tag blub');
  expect(removeTagsFromEnd(' #tag', detectTags(' #tag') as string[])).toStrictEqual('');
  //only remove from the end
  expect(
    removeTagsFromEnd(' #inlinetag blub #endtag', detectTags(' #inlinetag blub #endtag') as string[]),
  ).toStrictEqual(' #inlinetag blub');
  //remove multiple tags
  expect(removeTagsFromEnd('blub #endtag0 #endtag1', detectTags('blub #endtag0 #endtag1') as string[])).toStrictEqual(
    'blub',
  );
});
