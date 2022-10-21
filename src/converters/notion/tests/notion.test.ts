/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { expect, test } from '@jest/globals';
import { expectField, findNodeByName } from '../../../testUtils/testUtils';
import { TanaIntermediateNode } from '../../../types/types';
import { importNotionFile } from './testUtils';
import fs from 'fs';
import { mdToTana } from '../markdown';
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

test('Reports Broken link in preview', async () => {
  const [file, _f, fn] = importNotionFile('nodeRef.csv');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    calendarNodes: 0,
    fields: 6,
    leafNodes: 8,
    topLevelNodes: 2,
    totalNodes: 10,
  });

  const node = fn('Ivysaur');
  const link = fn('Link');
  const refs = (link?.children as TanaIntermediateNode[])[0].refs;

  expect(refs).toEqual([node?.uid]);
});

const convertMd = (fileToLoad: string) => {
  console.log(fileToLoad);
  const file = fs.readFileSync(`./src/converters/notion/tests/fixtures/${fileToLoad}`, 'utf8');

  if (!file) {
    throw Error('Could not load file');
  }

  return mdToTana(file);
};

test('Parses markdown file', () => {
  const [file] = importNotionFile('basic.md');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    calendarNodes: 0,
    fields: 0,
    leafNodes: 5,
    topLevelNodes: 5,
    totalNodes: 10,
  });
});

test('Parses markdown list', () => {
  const nodes = convertMd('todos.md');

  expect(nodes[0].todoState).toBe('todo');
  expect(nodes[1].todoState).toBe('done');
});

test('Respects markdown headers', () => {
  const nodes = convertMd('nestedNodes.md');
  const fn = (name: string) => findNodeByName(nodes, name);

  expect(nodes.length).toBe(2);

  const levelOne = fn('One')!;
  const levelOneContent = fn('one content')!;
  const levelTwo = fn('Two')!;
  const levelTwoContent = fn('two content')!;
  const levelThree = fn('Three')!;
  const levelThreeContent = fn('three content')!;
  const levelFour = fn('Four')!;
  const levelFourContent = fn('four content')!;
  const levelFive = fn('Five')!;
  const levelFiveContent = fn('five content')!;

  expect(levelOne.children?.length).toBe(3);
  expect(levelOne.children).toContain(levelOneContent);
  expect(levelOne.children).toContain(levelTwo);
  expect(levelOne.children).toContain(levelFour);

  expect(levelTwo.children).toContain(levelTwoContent);
  expect(levelTwo.children).toContain(levelThree);

  expect(levelThree.children).toContain(levelThreeContent);

  expect(levelFour.children).toContain(levelFourContent);

  expect(levelFive.children).toContain(levelFiveContent);
});
