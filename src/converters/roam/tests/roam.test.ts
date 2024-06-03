/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { expect, test } from 'vitest';
import { expectField, expectImage } from '../../../testUtils/testUtils.js';
import { importRoamFile } from './testUtils.js';

test('Smoke test import preview ', async () => {
  const [file] = importRoamFile('smoketest.json');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    topLevelNodes: 29,
    leafNodes: 45,
    fields: 7,
    totalNodes: 74,
    calendarNodes: 13,
  });

  expect(file.attributes).toEqual([
    {
      count: 2,
      name: 'Email',
      values: ['john@dutton.com', 'jack@black.com'],
    },
    { name: 'State', count: 2, values: ['Montana', 'California'] },

    {
      count: 2,
      name: 'Favorite meal',
      values: ['Blue steak', 'Pizza'],
    },
    {
      count: 1,
      name: 'Current City',
      values: ['Oslo'],
    },
  ]);
});

test('fields', () => {
  const [file, f, fn] = importRoamFile('fields.json');
  // TODO: We do not set fixed values yet

  expect(file.attributes).toEqual([
    {
      count: 1,
      name: 'Owner',
      values: ['[[Jack]]'],
    },
    {
      count: 1,
      name: 'Contact',
      values: ['[[Jack]]'],
    },
    {
      count: 1,
      name: 'definition',
      values: ['Now an alias for [foo](((someRefId)))'],
    },
    {
      count: 1,
      name: 'SomeField',
      values: ['[[Pete]]', '[[Jack]]', '[[Janet]]'],
    },
    {
      count: 1,
      name: 'Color',
      values: ['[[Red]]'],
    },
    {
      count: 1,
      name: 'City',
      values: ['[[Oslo]]'],
    },
  ]);

  expectField('fieldHolder', 'definition', ['Now an alias for [foo]([[someRefId]])'], f);

  expectField('jackFiled', 'Owner', ['[[jack]]'], f);

  const fieldValue = f('fieldHolder')?.children![0];
  expect(fieldValue?.refs).toEqual(['someRefId']);
  //[#Jack Black]
  // Color:: [[Red]]\nCity:: [[Oslo]]
  // We have one child with two attributes, so we expect two children
  const subsequentBrokenHolder = f('subsequentBrokenHolder');
  expectField(subsequentBrokenHolder?.children![0].uid, 'City', [fn('Oslo')!], f);
  expectField(subsequentBrokenHolder?.children![1].uid, 'Color', [fn('Red')!], f);

  expectField('multipleValuesSomeBroken', 'SomeField', [fn('Pete')!, fn('Jack')!, fn('Janet')!], f);
  expect(f('subsequentBrokenHolder')!.refs).toEqual([]);
  for (const child of f('subsequentBrokenHolder')!.children!) {
    expect(child.refs).toEqual([]);
  }

  // [[Contact]]:: [[Jack]]
  expectField('linkInFieldDef', 'Contact', [fn('Jack')!], f);
});

test('meta node extraction', () => {
  const [file, f, fn] = importRoamFile('meta_extract.json');
  expect(file.attributes).toEqual([
    {
      count: 2,
      name: 'SomeField',
      values: ['SomeValue', 'SomeValue'],
    },
  ]);

  const fieldAndNode = fn('Testcase: Fields+nodes in meta');

  const onlyField = file.nodes.find((n) => n.name === 'Testcase: Meta with only field');

  const onlyNode = file.nodes.find((n) => n.name === 'Testcase: Meta with only node');

  expect(fieldAndNode?.children!.length).toBe(2);

  // meta node had non-field, so make sure it's still present
  const fieldAndNodesMeta = fieldAndNode?.children![1];
  expect(fieldAndNodesMeta?.name).toBe('Meta');

  const theMetaNodesChild = fieldAndNodesMeta?.children![0];
  expect(theMetaNodesChild?.name).toBe('Just a node');

  expectField(fieldAndNode?.children![0].uid, 'SomeField', ['SomeValue'], f);

  // meta node only contained one child, so it shold not be present
  expect(onlyField?.children!.length).toBe(1);
  expectField(onlyField?.children![0].uid, 'SomeField', ['SomeValue'], f);

  expect(onlyNode?.children!.length).toBe(1);
  const onlyNodesMeta = onlyNode?.children![0];
  expect(onlyNodesMeta?.name).toBe('Meta');

  const onlyNodesMetaChild = onlyNodesMeta?.children![0];
  expect(onlyNodesMetaChild?.name).toBe('SomeNode');
});

test('Fix broken links', () => {
  const [, f, fn] = importRoamFile('broken_links.json');

  // [[Jack Black]] #peter #[[Peter Pan]]
  const jackBlack = fn('Jack Black');
  const peter = fn('peter');
  const peterPan = fn('Peter Pan');
  const johnDutton = fn('John Dutton');
  expect(jackBlack).toBeDefined();
  expect(peter).toBeDefined();
  expect(peterPan).toBeDefined();
  expect(johnDutton).toBeDefined();

  // "title": "[[Jack Black]] #peter #[[Peter Pan]] [jackieboy]([[John Dutton]]",
  expect(f('brokenLinkHost')?.name).toBe(
    `[[${jackBlack?.uid}]] [#peter]([[${peter?.uid}]]) [#Peter Pan]([[${peterPan?.uid}]]) [jackieboy]([[${johnDutton?.uid}]]`,
  );

  expect(f('brokenLinkHost2')?.name).toBe(
    `also link to [[${jackBlack?.uid}]] and [#peter]([[${peter?.uid}]]) should not create another`,
  );
  expect(fn('hashtag')).toBeDefined();

  expect(f('hashTagHost')?.refs).toEqual([fn('hashtag')?.uid]);

  expect(f('hashTagHost')?.name).toBe(`Some [#hashtag]([[${fn('hashtag')?.uid}]])`);
});

test('journal page conversion', () => {
  const [, , fn] = importRoamFile('journal_pages.json');
  const feb = fn('02-08-2022');
  expect(feb?.name).toBe('02-08-2022');
  expect(feb?.type).toBe('date');
  const mar = fn('03-31-2022');
  expect(mar?.name).toBe('03-31-2022');
  expect(mar?.type).toBe('date');
});
/**
 * Roam uses the following formats for links and embeds:
 *
 * - ((nodeId))
 * - [[node name]]
 * - #[[Jack Black]]
 * - #someText
 *
 * And then with aliases:
 * - [alias]([[page]])
 * - [alias](((nodeId)))
 *
 * These are to be converted to the following:
 * - ((nodeId)) with optional alias in refs section
 */
test('Standardize links', () => {
  const [, f] = importRoamFile('link_normalization.json');

  // ((jackBlack)) => [[jackBlack]]
  expect(f('embedJackBlack')?.name).toBe('[[jackBlack]]');

  // #[[Jack Black]] => [[jackBlack]] with alias set
  expect(f('blockAliasJackBlack')?.name).toBe('[#Jack Black]([[jackBlack]])');
  expect(f('blockAliasJackBlack')?.refs).toEqual(['jackBlack']);

  // [foobar]([[Jack Black]])
  expect(f('aliasLink')?.name).toBe('[foobar]([[jackBlack]])');

  expect(f('aliasLink')?.refs).toEqual(['jackBlack']);

  // [foobar](((jackBlack)))
  expect(f('aliasBlockRef')?.name).toBe('[foobar]([[jackBlack]])');
  expect(f('aliasBlockRef')?.refs).toEqual(['jackBlack']);
});

test('{{embed', () => {
  const [, f] = importRoamFile('embed.json');

  // Lets {{embed: ((theEmbedded))}}
  expect(f('embed1')?.name).toBe('Lets [[theEmbedded]]');
  // Lets also {{[[embed]]: ((theEmbedded))}}
  expect(f('embed2')?.name).toBe('Lets also [[theEmbedded]]');
  // Lets link {{embed: [[Embedded]]}}
  expect(f('link1')?.name).toBe('Lets link [[theEmbedded]]');
  // Lets also link {{[[embed]]: [[Embedded]]}}
  expect(f('link2')?.name).toBe('Lets also link [[theEmbedded]]');
});

test('Code blocks', () => {
  const [, f] = importRoamFile('codeblocks.json');

  expect(f('codeBlock1')?.type).toBe('codeblock');
  expect(f('codeBlock1')?.name).toBe('do not touch #[[Jack Black]] inside this one');

  expect(f('codeBlockSingle')?.type).toBe('codeblock');
  expect(f('codeBlockSingle')?.name).toBe('do not touch #[[Jack Black]] inside this one');

  expect(f('inlineCodeBlock1')?.name).toBe('before ```do not touch #[[Jack Black]] inside this one``` after');

  expect(f('inlineCodeBlock2')?.name).toBe(
    'before `do not touch #[[Jack Black]] #Jack Black inside this one either` after',
  );

  expect(f('otherCodeBlock')?.name).toBe('code here');
  expect(f('otherCodeBlock')?.type).toBe('codeblock');

  expect(f('codefield')?.type).toBe('codeblock');
  expect(f('codefield')?.children?.map(n=>n.uid)).toEqual([])
});

test('Complex / nested node', () => {
  const [, f] = importRoamFile('case_complex_names.json');

  expect(f('theyKey')?.name).toBe('🔑');

  expect(f('caseDriven')?.name).toBe('[[theyKey]] - case-driven analogizing');
  expect(f('schemaDriven')?.name).toBe('[[theyKey]] - schema-driven analogizing');

  expect(f('theComplexOne')?.name).toBe(
    'expect experts to focus on [[schemaDriven]] and novices to focus on [[caseDriven]]',
  );

  expect(f('interval')?.name).toBe('interval');
  expect(f('factor')?.name).toBe('factor');
  expect(f('interval32')?.name).toBe('[[interval]]:32.7');
  expect(f('factor230')?.name).toBe('[[factor]]:2.30');
  expect(f('computationalAnalogy')?.name).toBe('D/Computational Analogy');

  expect(f('connecting')?.name).toBe(
    'Connecting this to [[computationalAnalogy]], I keep thinking about the [[fundamentalDistinction]], and how the [[farAnalogies]] stuff just seems to fit so much better with the "make" side of things, which seems like a designerly thing (make stuff that works!) vs. understanding the nature of something.',
  );
  expect(f('fundamentalDistinction')?.name).toBe('fundamental distinction between make and understand');

  expect(f('04-27-2021')?.name).toBe('04-27-2021');
  expect(f('04-27-2021')?.type).toBe('date');
  expect(f('theBigOne')?.name).toBe(
    'Teasing out the design vs. science ([make vs. understand]([[connecting]])) [distinction]([[fundamentalDistinction]]), with implications for [[computationalAnalogy]] - this FEELS IMPORTANT  [[interval32]] [[factor230]] [[date:2021-04-27]]',
  );
  expect(f('theBigOne')?.refs).toEqual([
    'computationalAnalogy',
    'connecting',
    'fundamentalDistinction',
    'interval32',
    'factor230',
    '04-27-2021',
  ]);
});

test('Text decoration', () => {
  const [, f] = importRoamFile('text_decoration.json');

  // "**the bold**"
  expect(f('bold')?.name).toBe('<b>the bold</b>');
  // "__the underlined__"
  expect(f('underline')?.name).toBe('<i>the underlined</i>');

  // "^^the highlighted^^"
  expect(f('highlight')?.name).toBe('<mark>the highlighted</mark>');

  // ~~the striked~~
  expect(f('striked')?.name).toBe('<del>the striked</del>');

  // Cool::**Stuff**
  expectField('fieldBold', 'Cool', ['<b>Stuff</b>'], f);
});

test('Images', () => {
  const [, f] = importRoamFile('images.json');

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

test('Aliases', () => {
  const [, f, fn] = importRoamFile('alias.json');

  expect(f('pJ6scSv6R')?.type).toBe('node');
  expect(f('pJ6scSv6R')?.name).toBe('this is the [test page]([[9Kc68QbDR]])');

  expect(f('pJ6scSv6R')?.refs).toEqual(['9Kc68QbDR']);

  expect(f('plainLinkWithAlias')?.name).toBe(`Plain link: <a href="https://www.vg.no">someSite</a>`);

  // "string": "See this note [*](((3G_j8mOW5)))",
  expect(f('seeThisNote')?.name).toBe('See this note [*]([[3G_j8mOW5]])');
  expect(f('seeThisNote')?.refs).toEqual(['3G_j8mOW5']);

  // "title": "Complex ((3G_j8mOW5)) and [[Jack Black]]",
  // 3G_j8mOW5 is a broken embed,so we cannot do anything with taht
  expect(f('complexWithRefs')?.name).toBe('Complex ((3G_j8mOW5)) and [[jackBlack]]');
  expect(f('complexWithRefs')?.refs).toEqual(['jackBlack']);

  // "string": "Point to [[Complex ((3G_j8mOW5)) and [[Jack Black]]]]",
  expect(f('pointToToComplex')?.refs).toEqual(['jackBlack', 'complexWithRefs']);

  expect(f('pointToToComplex')?.name).toBe('Point to [[complexWithRefs]]');

  // for #link we add alias with #
  expect(f('hashTopical')?.name).toBe('See [#topic]([[topical]])');

  expect(f('hashTopical')?.refs).toEqual(['topical']);
  expect(f('manyAliases')?.name).toBe(
    `we can have many aliases [*]([[someNode]]) [*]([[someNode]]) [*]([[${fn('Broken Node')?.uid}]]) [*]([[${
      fn('Broken Node')?.uid
    }]]) in the same [block]([[date:2022-07-15]])`,
  );

  // "string": "this is the [##]([[tests]])",
  expect(f('doubleHashAlias')?.name).toBe('this is the [##]([[9Kc68QbDR]])');

  // "string": "block ref alias [*](((someNode))) [*](((someNode))) [*](((someBorkenNode))) [*](((someBorkenNode)))",
  // we do not touch the broken nodes, since we cant do anything with them
  expect(f('blockRefAlias')?.name).toBe(
    'block ref alias [*]([[someNode]]) [*]([[someNode]]) [*](((someBrokenId))) [*](((someBrokenId)))',
  );
});

test('Todo/Done', () => {
  const [, f] = importRoamFile('todo.json');
  // "title": "{{[[TODO]]}} Todo",
  expect(f('todo')?.type).toBe('node');
  expect(f('todo')?.name).toBe('Todo');
  expect(f('todo')?.todoState).toBe('todo');

  // "title": "{{[[DONE]]}} Done",
  expect(f('done')?.type).toBe('node');
  expect(f('done')?.name).toBe('Done');
  expect(f('done')?.todoState).toBe('done');
});

test('References', () => {
  const [, f] = importRoamFile('refs.json');
  // "string": "See [[first [[second]]]]",
  expect(f('container')?.name).toBe('See [[firstId]]');
  expect(f('container')?.refs).toEqual(['firstId']);
});

test('Corner cases', () => {
  const [, f, fn] = importRoamFile('corner_cases.json');

  // Tags ending with question mark:
  // "string": "See #some-tag?",
  expect(f('container')?.name).toBe('See [#some-tag]([[someRef]])?');
  expect(f('container')?.refs).toEqual(['someRef']);

  // "#> demo" should add ef with alias #>

  expect(f('doubleHash')?.name).toEqual('## demo');

  expect(f('gTHash')?.name).toEqual('#> demo');

  expect(f('someNodeId')?.name).toEqual('@someNodeName');
  expect(fn(`hello [[someNodeId]]`)).toBeDefined();

  expect(f('atLinkAtStart')?.name).toEqual(`[[someNodeId]] argues that basically [[helloId]]).`);

  // Link wrapped in brace: [[alias]([[@someNodeName]])]
  expect(f('theBroken')?.name).toEqual(`[[alias]([[someNodeId]])]`);

  // Top level page with Field::value
  expect(f('topLevelField')?.name).toEqual('Top level page with Field::value');
});

test('Skips {{[[roam/js]]}} etc', () => {
  const [, f] = importRoamFile('roam_js_css.json');
  expect(f('roamjs')).toBeUndefined();
  expect(f('roamcss')).toBeUndefined();
});
