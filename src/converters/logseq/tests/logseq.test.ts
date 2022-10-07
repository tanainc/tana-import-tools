/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { expect, test } from '@jest/globals';
import { expectField, expectImage } from '../../../testUtils/testUtils';
import { importLogseqFile } from './testUtils';

test('Summary smoketest', async () => {
  const [file] = importLogseqFile('smoketest.json');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    topLevelNodes: 5,
    leafNodes: 15,
    fields: 0,
    totalNodes: 20,
    calendarNodes: 3,
  });
});

test('Journal pages', () => {
  const [file, f] = importLogseqFile('journal_pages.json');

  expect(file.summary.topLevelNodes).toEqual(2);
  expect(file.summary.totalNodes).toEqual(2);
  expect(file.summary.calendarNodes).toEqual(1);
  expect(f('date1')?.name).toEqual('10-06-2022');
  expect(f('bad date')?.name).toEqual('Oct 6, 2022');
});

test('References', () => {
  const [file, f] = importLogseqFile('refs.json');

  expect(file.summary.topLevelNodes).toEqual(2);
  expect(file.summary.totalNodes).toEqual(4);
  const child = f('page1')?.children?.[0];
  expect(child?.name).toEqual('[[page2]]');
  expect(child?.refs).toEqual(['page2']);
});

test('Block references', () => {
  const [file, f] = importLogseqFile('block_refs.json');

  expect(file.summary.topLevelNodes).toEqual(3);
  expect(file.summary.totalNodes).toEqual(6);
  const child2 = f('page2')?.children?.[0];
  expect(child2?.name).toEqual('[[child1]]');
  expect(child2?.refs).toEqual(['child1']);
  const child3 = f('page3')?.children?.[0];
  expect(child3?.name).toEqual('See [[child2]]');
  expect(child3?.refs).toEqual(['child2']);
});

test('Images', () => {
  const [, f] = importLogseqFile('images.json');

  expect(f('single')?.type).toBe('image');

  expect(f('single')?.name).toBe('image');

  expect(f('single')?.mediaUrl).toBe('https://tana.inc/photo/1');

  // holds more images
  expect(f('container')?.type).toBe('node');
  expect(f('container')?.children!.length).toBe(3);

  expectImage('first', 'https://tana.inc/photo/1', f);
  expectImage('second', 'https://tana.inc/photo/2', f);

  expect(f('third')?.type).toBe('node');
  expect(f('third')?.children!.length).toBe(2);

  expectImage(f('third')?.children![0].uid, 'https://tana.inc/photo/3', f);
  expectImage(f('third')?.children![1].uid, 'https://tana.inc/photo/4', f);

  expect(f('third')?.name).toBe(
    `[[${f('third')?.children![0].uid}]] [[${f('third')?.children![1].uid}]] (pp. 726-727)`,
  );
});
