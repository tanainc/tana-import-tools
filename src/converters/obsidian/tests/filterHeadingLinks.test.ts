import { expect, test } from '@jest/globals';
import { filterHeadingLinks, HeadingLinks, HeadingTracker } from '../filterHeadingLinks';

test('filterHeadingLinks test', () => {
  const headingTracker: HeadingTracker = new Map();
  headingTracker.set('fileName', [
    { uid: '1', level: 1, content: '1' },
    { uid: '2', level: 2, content: '2' },
    { uid: '3', level: 3, content: '3' },
    { uid: '4', level: 3, content: '4' },
    { uid: '1_2', level: 1, content: '1_2' },
    { uid: '4_2', level: 3, content: '4' },
  ]);
  headingTracker.set('fileName2', [
    { uid: '3', level: 3, content: '3' },
    { uid: '1', level: 1, content: '1' },
  ]);
  headingTracker.set('fileName3', []); //empty is handled fine
  const headingLinks: HeadingLinks = new Map();
  headingLinks.set('fileName', [
    { uid: 'OLD_2', link: ['1', '2'] },
    { uid: 'OLD_3', link: ['1', '2', '3'] },
    { uid: 'OLD_4', link: ['4'] },
    { uid: 'DIRECT_3', link: ['3'] },
    { uid: 'INVALID_ORDER', link: ['3', '1'] }, //only exists in the other file
    { uid: 'INVALID_SUBTREES', link: ['1', '2', '3', '4'] },
    { uid: 'INVALID_LEVELS', link: ['1', '2', '1_2'] },
  ]);

  const [valid, invalid] = filterHeadingLinks(headingLinks, headingTracker);
  expect(valid).toStrictEqual([
    { old: 'OLD_2', new: '2' },
    { old: 'OLD_3', new: '3' }, //same target heading leads to same UID
    { old: 'OLD_4', new: '4' }, //first subtree is taken, because logically it is the first heading on the page
    { old: 'DIRECT_3', new: '3' },
  ]);
  expect(invalid.map((data) => data.uid)).toStrictEqual(['INVALID_ORDER', 'INVALID_SUBTREES', 'INVALID_LEVELS']);
});
