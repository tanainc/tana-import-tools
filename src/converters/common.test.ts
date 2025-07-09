import { expect, test } from 'vitest';
import { findPreceedingAlias, getAttributeDefinitionsFromName, getValueForAttribute, hasImages } from './common';

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

test('hasImages', () => {
  expect(hasImages('![](https://tana.inc/photo/1)')).toBeTruthy();
  expect(hasImages('![](https://tana.inc/photo/1) ![](https://tana.inc/photo/2)')).toBeTruthy();
  expect(hasImages('bar ![](https://tana.inc/photo/1) foo ![](https://tana.inc/photo/2) bam')).toBeTruthy();
  expect(hasImages('nope')).toBeFalsy();
});
