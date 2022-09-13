import { expect, test } from '@jest/globals';
import {
  findPreceedingAlias,
  getAttributeDefintionsFromName,
  getValueForAttribute,
  hasImages,
  dateStringToRoamDateUID,
  dateStringToYMD,
} from './roamUtils';

test('getAttributeDefintions', () => {
  expect(getAttributeDefintionsFromName('foo::bar')).toEqual(['foo']);
  expect(getAttributeDefintionsFromName('[[foo]]::bar')).toEqual(['foo']);
  expect(getAttributeDefintionsFromName('**foo:**')).toEqual(['foo']);
  expect(getAttributeDefintionsFromName('**foo:**\nbam::bim')).toEqual(['foo', 'bam']);
});

test('findPreceedingAlias', () => {
  expect(findPreceedingAlias('[foooo]([[bar]]', 6)).toBe('foooo');
  expect(findPreceedingAlias('[foooo]([[bar]]', 1)).toBe(undefined);
});

test('getValueForAttribute', () => {
  expect(getValueForAttribute('foo', 'foo::bar')).toEqual('bar');
  expect(getValueForAttribute('foo', '**foo:** bam')).toEqual('bam');
  expect(getValueForAttribute('bam', '**foo:**\nbam::bim')).toEqual('bim');
});

test('hasImages', () => {
  expect(hasImages('![](https://tana.inc/photo/1)')).toBeTruthy();
  expect(hasImages('![](https://tana.inc/photo/1) ![](https://tana.inc/photo/2)')).toBeTruthy();
  expect(hasImages('bar ![](https://tana.inc/photo/1) foo ![](https://tana.inc/photo/2) bam')).toBeTruthy();
  expect(hasImages('nope')).toBeFalsy();
});

test('dateStringToRoamDateUID', () => {
  expect(dateStringToRoamDateUID('June 1st, 2021')).toBe('06-01-2021');
  expect(dateStringToRoamDateUID('August 14th, 2021')).toBe('08-14-2021');
});
test('dateStringToYMD', () => {
  expect(dateStringToYMD('June 1st, 2021')).toBe('2021-06-01');
  expect(dateStringToYMD('August 14th, 2021')).toBe('2021-08-14');
});
