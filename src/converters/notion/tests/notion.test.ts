/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { expect, test } from '@jest/globals';
import { expectField } from '../../../testUtils/testUtils';
import { importNotionFile } from './testUtils';
test('Smoke test import preview ', async () => {
  const [file] = importNotionFile('singleNode.csv');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    calendarNodes: 0,
    fields: 8,
    leafNodes: 9,
    topLevelNodes: 1,
    totalNodes: 10,
  });

  expect(file.attributes).toEqual([
    {
      count: 1,
      name: 'Number',
      values: ['1'],
    },
    {
      count: 1,
      name: 'Entry',
      values: ['#001'],
    },
    {
      count: 1,
      name: 'Gen',
      values: ['1'],
    },
    {
      count: 1,
      name: 'Generation',
      values: ['Generation 1'],
    },
    {
      count: 1,
      name: 'Name',
      values: ['Bulbasaur'],
    },
    {
      count: 1,
      name: 'Japanese Name',
      values: ['Fushigidaneフシギダネ'],
    },
    {
      count: 1,
      name: 'Classfication',
      values: ['Seed Pokémon'],
    },
    {
      count: 1,
      name: 'Favourite',
      values: ['No'],
    },
  ]);
});

test('Reports Broken link in preview', async () => {
  const [file] = importNotionFile('brokenRef.csv');

  expect(file.summary).toEqual({
    brokenRefs: 1,
    calendarNodes: 0,
    fields: 3,
    leafNodes: 4,
    topLevelNodes: 1,
    totalNodes: 5,
  });
});

test('Handles notion exporting zero width characters', async () => {
  const [file] = importNotionFile('zeroWidthNoBreakFile.csv');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    calendarNodes: 0,
    fields: 2,
    leafNodes: 3,
    topLevelNodes: 1,
    totalNodes: 4,
  });

  expect(file.attributes).toEqual([
    {
      count: 1,
      name: 'Number',
      values: ['1'],
    },
    {
      count: 1,
      name: 'Name',
      values: ['Bulbasaur'],
    },
  ]);
});

test('fields', () => {
  const [_file, _f, fn] = importNotionFile('singleNode.csv');
  expectField('Number', 'Number', ['1'], fn);
  expectField('Entry', 'Entry', ['#001'], fn);
  expectField('Gen', 'Gen', ['1'], fn);
  expectField('Name', 'Name', ['Bulbasaur'], fn);
});
