import { expect, test } from '@jest/globals';
import { extractImageLinks } from '../extractImageLinks';

//TODO: write some test utils to check permutations easier

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
    //could support this in the future, but couldnt re-use the general URL extraction function then
    '[![this is a linked image without an URL in the embedded](/cool/vault/path.jpg)](https://url)',
  ];
  noLinks.forEach((content) => expect(extractImageLinks(content)).toStrictEqual([]));

  expect(extractImageLinks('![test](http://test)')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length, '![test](http://test)'],
  ]);

  expect(extractImageLinks('![test](http://test "unsupported title!")')).toStrictEqual([
    [
      'test',
      'http://test',
      '![test](http://test "unsupported title!")'.length,
      '![test](http://test "unsupported title!")',
    ],
  ]);

  expect(extractImageLinks('some text ![test](http://test)')).toStrictEqual([
    ['test', 'http://test', 'some text ![test](http://test)'.length, '![test](http://test)'],
  ]);

  expect(extractImageLinks('some text\n ![test](http://test)')).toStrictEqual([
    ['test', 'http://test', 'some text\n ![test](http://test)'.length, '![test](http://test)'],
  ]);

  expect(extractImageLinks('![test](http://test) some text')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length, '![test](http://test)'],
  ]);

  expect(extractImageLinks('![test](http://test) ![test2](https://test2)')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length, '![test](http://test)'],
    ['test2', 'https://test2', '![test](http://test) ![test2](https://test2)'.length, '![test2](https://test2)'],
  ]);

  expect(extractImageLinks('some text ![test](http://test) ![test2](https://test2)')).toStrictEqual([
    ['test', 'http://test', 'some text ![test](http://test)'.length, '![test](http://test)'],
    [
      'test2',
      'https://test2',
      'some text ![test](http://test) ![test2](https://test2)'.length,
      '![test2](https://test2)',
    ],
  ]);

  expect(extractImageLinks('some text ![test](http://test) ![test2](https://test2) some text')).toStrictEqual([
    ['test', 'http://test', 'some text ![test](http://test)'.length, '![test](http://test)'],
    [
      'test2',
      'https://test2',
      'some text ![test](http://test) ![test2](https://test2)'.length,
      '![test2](https://test2)',
    ],
  ]);

  expect(extractImageLinks('![test](http://test) some text ![test2](https://test2)')).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length, '![test](http://test)'],
    [
      'test2',
      'https://test2',
      '![test](http://test) some text ![test2](https://test2)'.length,
      '![test2](https://test2)',
    ],
  ]);

  expect(extractImageLinks('some text ![test](http://test) some text ![test2](https://test2) some text')).toStrictEqual(
    [
      ['test', 'http://test', 'some text ![test](http://test)'.length, '![test](http://test)'],
      [
        'test2',
        'https://test2',
        'some text ![test](http://test) some text ![test2](https://test2)'.length,
        '![test2](https://test2)',
      ],
    ],
  );

  expect(
    extractImageLinks(
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ),
  ).toStrictEqual([
    [
      'ancient public baths',
      'http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg',
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)'
        .length,
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ],
  ]);

  expect(
    extractImageLinks(
      'some text [![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ),
  ).toStrictEqual([
    [
      'ancient public baths',
      'http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg',
      'some text [![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)'
        .length,
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ],
  ]);

  expect(
    extractImageLinks(
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg) some text',
    ),
  ).toStrictEqual([
    [
      'ancient public baths',
      'http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg',
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)'
        .length,
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ],
  ]);

  expect(
    extractImageLinks(
      '![test](http://test) [![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ),
  ).toStrictEqual([
    ['test', 'http://test', '![test](http://test)'.length, '![test](http://test)'],
    [
      'ancient public baths',
      'http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg',
      '![test](http://test) [![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)'
        .length,
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ],
  ]);

  expect(
    extractImageLinks(
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg) ![test](http://test)',
    ),
  ).toStrictEqual([
    [
      'ancient public baths',
      'http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg',
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)'
        .length,
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg)',
    ],
    [
      'test',
      'http://test',
      '[![ancient public baths](http://different)](http://dankoboldt.com/wp-content/uploads/2020/07/ancient-public-baths.jpg) ![test](http://test)'
        .length,
      '![test](http://test)',
    ],
  ]);
  expect(extractImageLinks('[![partial embedded link](http://different)](http)]')).toStrictEqual([
    [
      'partial embedded link',
      'http://different',
      '[![partial embedded link](http://different)'.length,
      '![partial embedded link](http://different)',
    ],
  ]);
  expect(extractImageLinks('[![partial embedded link](http://different)](http)')).toStrictEqual([
    [
      'partial embedded link',
      'http://different',
      '[![partial embedded link](http://different)'.length,
      '![partial embedded link](http://different)',
    ],
  ]);
});
