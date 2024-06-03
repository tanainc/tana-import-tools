import { expect, test } from 'vitest';
import {
  findPreceedingAlias,
  getAttributeDefinitionsFromName,
  getValueForAttribute,
  hasImages,
  dateStringToUSDateUID,
  dateStringToYMD,
} from './common';

test('getAttributeDefintions', () => {
  expect(getAttributeDefinitionsFromName('foo::bar')).toEqual(['foo']);
  expect(getAttributeDefinitionsFromName('[[foo]]::bar')).toEqual(['foo']);
  expect(getAttributeDefinitionsFromName('**foo:**')).toEqual([]);
  expect(getAttributeDefinitionsFromName('**foo:**\nbam::bim')).toEqual(['bam']);
});

test('findPreceedingAlias', () => {
  expect(findPreceedingAlias('[foooo]([[bar]]', 6)).toBe('foooo');
  expect(findPreceedingAlias('[foooo]([[bar]]', 1)).toBe(undefined);
});

test('getValueForAttribute', () => {
  expect(getValueForAttribute('foo', 'foo::bar')).toEqual('bar');
  expect(getValueForAttribute('foo', '**foo:** bam')).toEqual(undefined);
  expect(getValueForAttribute('bam', '**foo:**\nbam::bim')).toEqual('bim');
});

test('dateStringToUSDateUID', () => {
  expect(dateStringToUSDateUID('June 1st, 2021')).toBe('06-01-2021');
  expect(dateStringToUSDateUID('August 14th, 2021')).toBe('08-14-2021');
  expect(dateStringToYMD('February 13th, 2023')).toBe('2023-02-13');
});

test('dateStringToYMD', () => {
  expect(dateStringToYMD('June 1st, 2021')).toBe('2021-06-01');
  expect(dateStringToYMD('August 14th, 2021')).toBe('2021-08-14');
  expect(dateStringToYMD('February 13th, 2023')).toBe('2023-02-13');
});

test('hasImages', () => {
  expect(hasImages('![](https://tana.inc/photo/1)')).toBeTruthy();
  expect(hasImages('![](https://tana.inc/photo/1) ![](https://tana.inc/photo/2)')).toBeTruthy();
  expect(hasImages('bar ![](https://tana.inc/photo/1) foo ![](https://tana.inc/photo/2) bam')).toBeTruthy();
  expect(hasImages('nope')).toBeFalsy();
});
