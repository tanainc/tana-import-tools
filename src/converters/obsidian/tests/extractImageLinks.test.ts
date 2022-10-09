import { expect, test } from '@jest/globals';
import { extractImageLinks } from '../extractImageLinks';

test('extractImageLinks test', () => {
  const noLinks = [
    '',
    ' ',
    'no links here\nand here',
    '![this is invalid](because it does not end ![but we start another link and try to end the first one)',
    '![this is a link](without an URL)',
    '![this is a link](without an URL) ![this is two links](httpp://without an URL)',
    //we accept image links with technically invalid characters in them (like []) because why not as long as the urls work, but a linebreak should really be considered invalid
    '![\nthis is a link with a linebreak](https://test)',
    '![this is a link with a linebreak\n](https://test)',
    '![this is a link with a\nlinebreak](https://test)',
    '![this is a link with a linebreak](https://\ntest)',
    '![this is a link with a linebreak](https://test\n)',
  ];
  noLinks.forEach((content) => expect(extractImageLinks(content)).toStrictEqual([]));

  expect(extractImageLinks('![test](http://test)')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length],
  ]);

  expect(extractImageLinks('some text ![test](http://test)')).toStrictEqual([
    ['test', 'http://test', 'some text ![test](http://test)'.length],
  ]);

  expect(extractImageLinks('some text\n ![test](http://test)')).toStrictEqual([
    ['test', 'http://test', 'some text\n ![test](http://test)'.length],
  ]);

  expect(extractImageLinks('![test](http://test) some text')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length],
  ]);

  expect(extractImageLinks('![test](http://test) ![test2](https://test2)')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length],
    ['test2', 'https://test2', '![test](http://test) ![test2](https://test2)'.length],
  ]);

  expect(extractImageLinks('some text ![test](http://test) ![test2](https://test2)')).toStrictEqual([
    ['test', 'http://test', 'some text ![test](http://test)'.length],
    ['test2', 'https://test2', 'some text ![test](http://test) ![test2](https://test2)'.length],
  ]);

  expect(extractImageLinks('some text ![test](http://test) ![test2](https://test2) some text')).toStrictEqual([
    ['test', 'http://test', 'some text ![test](http://test)'.length],
    ['test2', 'https://test2', 'some text ![test](http://test) ![test2](https://test2)'.length],
  ]);

  expect(extractImageLinks('![test](http://test) some text ![test2](https://test2)')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length],
    ['test2', 'https://test2', '![test](http://test) some text ![test2](https://test2)'.length],
  ]);

  expect(extractImageLinks('some text ![test](http://test) some text ![test2](https://test2) some text')).toStrictEqual(
    [
      ['test', 'http://test', 'some text ![test](http://test)'.length],
      ['test2', 'https://test2', 'some text ![test](http://test) some text ![test2](https://test2)'.length],
    ],
  );
});
