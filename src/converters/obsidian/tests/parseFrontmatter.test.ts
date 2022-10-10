import { expect, test } from '@jest/globals';
import { parseFrontmatter } from '../parseFrontmatter';

test('parseFrontmatter test', () => {
  expect(parseFrontmatter('')).toStrictEqual([]);
  expect(parseFrontmatter('key:')).toStrictEqual([{ key: 'key', values: [] }]);
  expect(parseFrontmatter('key: ')).toStrictEqual([{ key: 'key', values: [] }]);
  expect(
    parseFrontmatter(
      //multiple empty keys with different empty space
      `key: 
 key2:`,
    ),
  ).toStrictEqual([
    { key: 'key', values: [] },
    { key: 'key2', values: [] },
  ]);
  expect(
    parseFrontmatter(
      `key: value
key2:`,
    ),
  ).toStrictEqual([
    { key: 'key', values: ['value'] },
    { key: 'key2', values: [] },
  ]);
  expect(
    parseFrontmatter(
      `key: value
key2: [value1, value2]`,
    ),
  ).toStrictEqual([
    { key: 'key', values: ['value'] },
    { key: 'key2', values: ['value1', 'value2'] },
  ]);
  expect(
    parseFrontmatter(
      `key: value
       key2: value2
       key3: [one, two, three]
       key4:
       - four
       - five
       - six`,
    ),
  ).toStrictEqual([
    { key: 'key', values: ['value'] },
    { key: 'key2', values: ['value2'] },
    { key: 'key3', values: ['one', 'two', 'three'] },
    { key: 'key4', values: ['four', 'five', 'six'] },
  ]);
  //skipping obisidan specific frontmatter works
  expect(
    parseFrontmatter(
      `key: value
       publish: true
       key2: value2
       cssclass: cool-class
       key3: [one, two, three]
       key4:
       - four
       - five
       - six
       aliases: [cool alias1, cool alias2]
       `,
    ),
  ).toStrictEqual([
    { key: 'key', values: ['value'] },
    { key: 'key2', values: ['value2'] },
    { key: 'key3', values: ['one', 'two', 'three'] },
    { key: 'key4', values: ['four', 'five', 'six'] },
  ]);
  expect(
    parseFrontmatter(
      `key: value
       key4:
       - four
       - five
       - six 
       key2: value2
       key3: [one, two, three]
       `,
    ),
  ).toStrictEqual([
    { key: 'key', values: ['value'] },
    { key: 'key4', values: ['four', 'five', 'six'] },
    { key: 'key2', values: ['value2'] },
    { key: 'key3', values: ['one', 'two', 'three'] },
  ]);
});
