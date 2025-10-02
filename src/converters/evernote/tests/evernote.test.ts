import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';

import { EvernoteConverter } from '../index.js';
import {
  expectField,
  importFileAndGetHelpers,
  IdLookupHelper,
  NameLookupHelper,
} from '../../../testUtils/testUtils.js';
import { TanaIntermediateFile, TanaIntermediateNode } from '../../../types/types.js';

const FIXTURE = path.resolve(__dirname, 'fixtures/smoketest.enex');

describe('Evernote converter', () => {
  let file: TanaIntermediateFile;
  let byId: IdLookupHelper;
  let byName: NameLookupHelper;

  beforeAll(() => {
    [file, byId, byName] = importFileAndGetHelpers(new EvernoteConverter(), FIXTURE);
  });

  const findNodeSatisfying = (predicate: (node: TanaIntermediateNode) => boolean): TanaIntermediateNode | undefined => {
    const walk = (nodes?: TanaIntermediateNode[]): TanaIntermediateNode | undefined => {
      if (!nodes) {
        return undefined;
      }
      for (const node of nodes) {
        if (predicate(node)) {
          return node;
        }
        const inChildren = walk(node.children);
        if (inChildren) {
          return inChildren;
        }
      }
    };
    return walk(file.nodes);
  };

  it('summarises the file', () => {
    expect(file.summary.totalNodes).toBeGreaterThan(0);
    expect(file.summary.calendarNodes).toBe(2);
    expect(file.summary.fields).toBeGreaterThanOrEqual(4);
    expect(file.summary.brokenRefs).toBe(0);
  });

  it('converts daily notes to calendar nodes', () => {
    const dateNode = byName('2025-09-30');
    expect(dateNode).toBeDefined();
    expect(dateNode?.type).toBe('date');
    expect(dateNode?.children?.length).toBeGreaterThan(0);

    const secondDate = byName('2025-10-01');
    expect(secondDate).toBeDefined();
    expect(secondDate?.type).toBe('date');
  });

  it('excludes calendar nodes from home node ids', () => {
    const homeIds = new Set(file.homeNodeIds);
    const firstCalendar = byName('2025-09-30');
    const anotherNote = byName('Another note');

    expect(firstCalendar).toBeDefined();
    expect(anotherNote).toBeDefined();
    expect(homeIds.has(firstCalendar?.uid ?? '')).toBe(false);
    expect(homeIds.has(anotherNote?.uid ?? '')).toBe(true);
  });

  it('preserves indentation hierarchy', () => {
    const indentParent = byName('Indent parent');
    expect(indentParent).toBeDefined();
    const firstChild = indentParent?.children?.find((child) => child.name === 'indented node');
    expect(firstChild).toBeDefined();
    const secondLevel = firstChild?.children?.find((child) => child.name === '2nd level indented node');
    expect(secondLevel).toBeDefined();
  });

  it('converts bulleted lists into child nodes', () => {
    const heading = byName('✨ Bulleted list');
    expect(heading).toBeDefined();
    expect(heading?.children?.length).toBe(4);
    const firstBullet = heading?.children?.[0];
    expect(firstBullet?.name.startsWith('**Break big projects into smaller tasks.**')).toBeTruthy();
  });

  it('marks code blocks correctly', () => {
    const codeNode = byName('var abc = 123;');
    expect(codeNode).toBeDefined();
    expect(codeNode?.type).toBe('codeblock');
    expect(codeNode?.codeLanguage).toBe('javascript');
  });

  it('converts images with data URIs', () => {
    const imageNode = byName('unsplash-shrunk.jpg');
    expect(imageNode).toBeDefined();
    expect(imageNode?.type).toBe('image');
    expect(imageNode?.mediaUrl?.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('resolves evernote links to internal references', () => {
    const target = byName('Another note');
    expect(target).toBeDefined();
    const targetUid = target?.uid;
    expect(targetUid).toBeDefined();

    const inlineNode = byName(`[Inline link]([[${targetUid}]]) to another note`);
    expect(inlineNode).toBeDefined();
    expect(inlineNode?.refs).toContain(targetUid);

    const directLink = byName(`[Another note]([[${targetUid}]])`);
    expect(directLink).toBeDefined();
    expect(directLink?.refs).toContain(targetUid);
  });

  it('creates table nodes with field columns', () => {
    const tableNode = byName('Table');
    expect(tableNode).toBeDefined();
    expect(tableNode?.viewType).toBe('table');
    expect(tableNode?.children?.length).toBe(2);

    const joeRow = tableNode?.children?.find((child) => child.name === 'Joe');
    expect(joeRow).toBeDefined();
    const joeNameField = joeRow?.children?.find((child) => child.name === 'Name');
    expect(joeNameField).toBeUndefined();
    const joeAgeField = joeRow?.children?.find((child) => child.name === 'Age');
    expect(joeAgeField).toBeDefined();
    expectField(joeAgeField?.uid, 'Age', ['59'], byId);

    const anneRow = tableNode?.children?.find((child) => child.name === 'Anne');
    expect(anneRow).toBeDefined();
    const anneNameField = anneRow?.children?.find((child) => child.name === 'Name');
    expect(anneNameField).toBeUndefined();
    const anneAgeField = anneRow?.children?.find((child) => child.name === 'Age');
    expect(anneAgeField).toBeDefined();
    expectField(anneAgeField?.uid, 'Age', ['36'], byId);
  });

  it('aggregates fields into attributes summary', () => {
    const attributes = file.attributes || [];
    const ageAttribute = attributes.find((attr) => attr.name === 'Age');
    expect(ageAttribute).toBeDefined();
    expect(ageAttribute?.values).toEqual(['59', '36']);
    expect(ageAttribute?.count).toBe(2);
  });

  it('deduplicates attribute values while maintaining count', () => {
    const attributes = file.attributes || [];
    const authorAttribute = attributes.find((attr) => attr.name === 'Author');
    expect(authorAttribute).toBeDefined();
    // Should have only one unique value despite appearing 6 times
    expect(authorAttribute?.values).toEqual(['mikojunkye762a60aff50a426']);
    expect(authorAttribute?.count).toBe(6);
  });

  it('converts highlights and inline dates', () => {
    const highlightNode = byName('some text with ^^highlights^^');
    expect(highlightNode).toBeDefined();
  });

  it('creates date reference nodes', () => {
    const parent = byName('2025-09-30');
    expect(parent).toBeDefined();
    const children = parent?.children ?? [];
    const dateRefIndex = children.findIndex((child) => child.name === '[[date:2024-09-30]]');

    expect(dateRefIndex).toBeGreaterThanOrEqual(0);
    expect(children[dateRefIndex]?.type).toBe('node');
  });

  it('adds tasks beneath their task group sections', () => {
    const highPriority = byName('❗High priority');
    expect(highPriority).toBeDefined();
    const taskOne = highPriority?.children?.find((child) => child.name === 'high priority task 1');
    expect(taskOne).toBeDefined();
    expect(taskOne?.todoState).toBe('todo');

    const flaggedField = taskOne?.children?.find((child) => child.name === 'Flagged');
    expect(flaggedField).toBeDefined();
    expectField(flaggedField?.uid, 'Flagged', ['true'], byId);

    const mediumPriority = byName('⚡ Medium priority');
    expect(mediumPriority).toBeDefined();
    const dueTask = mediumPriority?.children?.find(
      (child) => child.name === 'medium task priority with tomorrow due date',
    );
    expect(dueTask).toBeDefined();
    expect(dueTask?.todoState).toBe('todo');
    const dueField = dueTask?.children?.find((child) => child.name === 'Due date');
    expect(dueField).toBeDefined();
    const dueValue = dueField?.children?.[0];
    expect(dueValue?.type).toBe('date');
    expect(dueValue?.name).toBe('2025-10-02');
  });

  it('stores author metadata as fields', () => {
    const calendarNote = byName('2025-09-30');
    const authorField = calendarNote?.children?.find((child) => child.name === 'Author');
    expectField(authorField?.uid, 'Author', ['mikojunkye762a60aff50a426'], byId);
  });
});
