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

    const firstRow = tableNode?.children?.[0];
    expect(firstRow).toBeDefined();
    const firstRowCol1 = firstRow?.children?.find((child) => child.name === 'Column 1');
    expect(firstRowCol1).toBeDefined();
    expectField(firstRowCol1?.uid, 'Column 1', ['table row 1 col 1'], byId);
    const firstRowCol2 = firstRow?.children?.find((child) => child.name === 'Column 2');
    expect(firstRowCol2).toBeDefined();
    expectField(firstRowCol2?.uid, 'Column 2', ['table row 1 col 2'], byId);

    const secondRow = tableNode?.children?.[1];
    expect(secondRow).toBeDefined();
    const secondRowCol1 = secondRow?.children?.find((child) => child.name === 'Column 1');
    expect(secondRowCol1).toBeDefined();
    expectField(secondRowCol1?.uid, 'Column 1', ['table row 2 col 1'], byId);
    const secondRowCol2 = secondRow?.children?.find((child) => child.name === 'Column 2');
    expect(secondRowCol2).toBeDefined();
    expectField(secondRowCol2?.uid, 'Column 2', ['table row 2 col 2'], byId);
  });

  it('converts highlights and inline dates', () => {
    const highlightNode = byName('some text with ^^highlights^^');
    expect(highlightNode).toBeDefined();

    const inlineDate = byName('[[2024-09-30]]');
    expect(inlineDate).toBeDefined();
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
    expectField(dueField?.uid, 'Due date', ['[[2025-10-02]]'], byId);
  });

  it('stores author metadata as fields', () => {
    const calendarNote = byName('2025-09-30');
    const authorField = calendarNote?.children?.find((child) => child.name === 'Author');
    expectField(authorField?.uid, 'Author', ['mikojunkye762a60aff50a426'], byId);
  });
});
