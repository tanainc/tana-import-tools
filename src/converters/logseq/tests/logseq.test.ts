import { expect, test } from 'vitest';
import { expectImage } from '../../../testUtils/testUtils.js';
import { getField, importLogseqFile, hasHeadingField } from './testUtils.js';

test('Summary smoketest', () => {
  const [file] = importLogseqFile('smoketest.json');

  expect(file.summary).toEqual({
    brokenRefs: 0,
    topLevelNodes: 7,
    leafNodes: 18,
    fields: 10,
    totalNodes: 25,
    calendarNodes: 3,
  });
});

test('Journal pages', () => {
  const [file, f] = importLogseqFile('journal_pages.json');

  expect(file.summary.topLevelNodes).toEqual(2);
  expect(file.summary.totalNodes).toEqual(2);
  expect(file.summary.calendarNodes).toEqual(1);
  expect(f('date1')?.name).toEqual('2022-10-06');
  expect(f('bad date')?.name).toEqual('Oct 6st 2022');
});

test('References', () => {
  const [file, f] = importLogseqFile('refs.json');

  expect(file.summary.topLevelNodes).toEqual(2);
  expect(file.summary.totalNodes).toEqual(4);
  const child = f('page1')?.children?.[0];
  expect(child?.name).toEqual('[[page2]]');
  expect(child?.refs).toEqual(['page2']);
});

test('Block references', () => {
  const [file, f] = importLogseqFile('block_refs.json');

  expect(file.summary.topLevelNodes).toEqual(3);
  expect(file.summary.totalNodes).toEqual(7);
  const child2 = f('page2')?.children?.[0];
  expect(child2?.name).toEqual('[[child1]]');
  expect(child2?.refs).toEqual(['child1']);
  const child3 = f('page3')?.children?.[0];
  expect(child3?.name).toEqual('See [[child2]]');
  expect(child3?.refs).toEqual(['child2']);
  const child4 = f('page3')?.children?.[1];
  expect(child4?.name).toEqual('inline [block reference]([[child2]]) on arbitrary text');
  expect(child4?.refs).toEqual(['child2']);
});

test('Codeblocks', () => {
  const [, f] = importLogseqFile('codeblocks.json');

  expect(f('block-with-type')?.name).toEqual('\nconst tana = "cool";\n');
  expect(f('block-with-type')?.type).toEqual('codeblock');
  expect(f('inline-block')?.type).toEqual('node');
  expect(f('block-no-type')?.name).toEqual('\nno language type here\n');
});

test('Images', () => {
  const [, f] = importLogseqFile('images.json');

  expect(f('single')?.type).toBe('image');

  expect(f('single')?.name).toBe('image');

  expect(f('single')?.mediaUrl).toBe('https://tana.inc/photo/1');

  // holds more images
  const container = f('container')!;
  expect(container.type).toBe('node');
  expect(container.children!.length).toBe(3);

  expectImage('first', 'https://tana.inc/photo/1', f);
  expectImage('second', 'https://tana.inc/photo/2', f);

  const third = f('third')!;
  expect(third.type).toBe('node');
  expect(third.children!.length).toBe(2);

  expectImage(third.children![0].uid, 'https://tana.inc/photo/3', f);
  expectImage(third.children![1].uid, 'https://tana.inc/photo/4', f);

  expect(third.name).toBe(`[[${third.children![0].uid}]] [[${third.children![1].uid}]] (pp. 726-727)`);
});

test('Headings', () => {
  const [file, f] = importLogseqFile('headings.json');
  // Top-level is the page node
  expect(file.summary.topLevelNodes).toEqual(1);
  // All nodes in the fixture
  expect(file.summary.totalNodes).toEqual(11);

  // child1: # Header level 1
  const h1 = f('child1');
  expect(h1?.flags).toEqual(['section']);
  expect(h1?.name).toBe('Header level 1');

  // child2: ## Header level 2
  const h2 = f('child2');
  expect(h2?.flags).toEqual(['section']);
  expect(h2?.name).toBe('Header level 2');

  // child3: property heading: 1, content: ## Header level 1
  const h3 = f('child3')!;
  expect(h3.flags).toEqual(['section']);
  expect(h3.name).toBe('Header level 1');
  expect(hasHeadingField(h3)).toBe(false);
  // child3-1: property heading: 2, content: ## Nested header level 2
  const h3_1 = f('child3-1')!;
  expect(h3_1.flags).toEqual(['section']);
  expect(h3_1.name).toBe('Nested header level 2');
  expect(hasHeadingField(h3_1)).toBe(false);

  // child4: not a header, but child4-1 is
  const notHeader = f('child4');
  expect(notHeader?.flags).toBeUndefined();
  const h4_1 = f('child4-1')!;
  expect(h4_1.flags).toEqual(['section']);
  expect(h4_1.name).toBe('Nested header level 3');
  expect(hasHeadingField(h4_1)).toBe(false);

  // child5: #not a header (should not be flagged)
  const notHeader2 = f('child5');
  expect(notHeader2?.flags).toBeUndefined();
  expect(notHeader2?.name).toMatch(/^\[#not\]\(\[\[.+\]\]\) a header$/); // hashtag gets converted to link format

  // child6: ##also not a header (should not be flagged)
  const notHeader3 = f('child6');
  expect(notHeader3?.flags).toBeUndefined();
  expect(notHeader3?.name).toMatch(/^\[##also\]\(\[\[.+\]\]\) not a header$/); // hashtag gets converted to link format

  // child7: property heading: 1, content: #  double spaced-header
  // (should be flagged, and name stripped)
  const h7 = file.nodes[0].children?.find(
    (n: { uid: string; flags?: string[] }) => n.uid === 'child7' && n.flags?.[0] === 'section',
  );
  expect(h7?.flags).toEqual(['section']);
  expect(h7?.name).toBe('double spaced-header');

  // child8: property heading: 1, content: not prefixed with pound but has a heading property
  // (should be flagged, name kept as-is since no # prefix to strip)
  const h8 = f('child8')!;
  expect(h8.flags).toEqual(['section']);
  expect(h8.name).toBe('not prefixed with pound but has a heading property');
  expect(hasHeadingField(h8)).toBe(false);
});

test('Fields', () => {
  const [file, f] = importLogseqFile('fields.json');

  expect(file.summary.fields).toEqual(5);
  expect(file.attributes?.length).toEqual(3);

  const page1 = f('page1');
  expect(page1?.children?.length).toBe(3);

  const blockAttrs = getField('blockAttrs', 'refs', f);
  expect(blockAttrs.type).toBe('field');
  expect(blockAttrs.children?.length).toBe(2);
});

test('Date formats', () => {
  for (const filename of ['date_format_MM_dd_yyyy.json', 'date_format_MMM do, yyyy.json']) {
    const [file, f] = importLogseqFile(filename);

    expect(file.summary.topLevelNodes).toEqual(2);
    expect(file.summary.totalNodes).toEqual(3);
    expect(file.summary.calendarNodes).toEqual(2);
    expect(f('date1')?.name).toEqual('2022-10-06');
    expect(f('date2')?.name).toEqual('2022-10-07');
    expect(f('date2')?.children?.length).toEqual(1);
    expect(f('date2')?.children?.[0].name).toEqual('Link to [[date:2022-10-06]]');
    expect(f('date2')?.children?.[0].refs).toEqual([]);
  }
});
test('Todos', () => {
  const [file, f] = importLogseqFile('todo.json');
  expect(file.summary.topLevelNodes).toEqual(1);
  expect(file.summary.totalNodes).toEqual(8);

  expect(f('child1')?.type).toBe('node');
  expect(f('child1')?.name).toBe('later task');
  expect(f('child1')?.todoState).toBe('todo');

  // NOW (DOING) not yet supported, just a regular TODO in Tana
  expect(f('child2')?.type).toBe('node');
  expect(f('child2')?.name).toContain('now task');
  expect(f('child2')?.todoState).toBe('todo');

  expect(f('child3')?.type).toBe('node');
  expect(f('child3')?.name).toBe('done task');
  expect(f('child3')?.todoState).toBe('done');

  expect(f('child4')?.type).toBe('node');
  expect(f('child4')?.name).toBe('not a task');
  expect(f('child4')?.todoState).toBe(undefined);

  expect(f('child5')?.type).toBe('node');
  expect(f('child5')?.name).toBe('todo task');
  expect(f('child5')?.todoState).toBe('todo');

  // DOING not yet supported, just a regular TODO in Tana
  expect(f('child6')?.type).toBe('node');
  expect(f('child6')?.name).toContain('doing task');
  expect(f('child6')?.todoState).toBe('todo');

  // CANCELED not yet supported, just treat as DONE in Tana prefixed with CANCELED
  expect(f('child7')?.type).toBe('node');
  expect(f('child7')?.name).toContain('CANCELED canceled task');
  expect(f('child7')?.todoState).toBe('done');
});
