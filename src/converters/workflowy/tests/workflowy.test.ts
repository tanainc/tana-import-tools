import { expect, test } from 'vitest';
import { importWorkflowyFile } from './testUtils.js';

test('Smoke test import preview ', () => {
  const [file, , fn] = importWorkflowyFile('smoketest.opml');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    topLevelNodes: 0,
    leafNodes: 6,
    fields: 0,
    totalNodes: 8,
    calendarNodes: 0,
  });

  expect(file.attributes).toBeUndefined();

  const node1 = fn('Hello how are you')!;
  expect(node1.children!.length).toBe(2);
  expect(node1.description).toBe('Some note here');
  expect(node1.children![0].name).toBe('Good');
  expect(node1.children![1].name).toBe('Great');

  expect(fn('LinkNode')!.children![0].name).toBe('<a href="https://www.vg.no/">alias here</a>');

  expect(fn('Todo1')?.todoState).toBe('done');
  expect(fn('Todo2')?.todoState).toBe('done');
  expect(fn('Todo3')?.todoState).toBe('done');
});
