import { test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RoamConverter } from './roam/index.js';
import { LogseqConverter } from './logseq/index.js';
import { WorkflowyConverter } from './workflowy/index.js';
import { EvernoteConverter } from './evernote/index.js';
import { MarkdownConverter } from './markdown/index.js';
import { createTifFile } from './createTifFile.js';
import type { SourceGraph, SourceNode } from './sourceGraph.js';
import type { TanaIntermediateFile, TanaIntermediateNode } from '../types/types.js';

function descendants(file: TanaIntermediateFile): TanaIntermediateNode[] {
  const nodes: TanaIntermediateNode[] = [];
  const stack: TanaIntermediateNode[] = Object.values(file.contents).flat();
  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    nodes.push(node);
    if ('isRef' in node && node.isRef) {
      continue;
    }
    if ('children' in node) {
      stack.push(...(node.children ?? []));
    }
    if ('values' in node) {
      for (const value of node.values ?? []) {
        if (typeof value === 'object' && value !== null && ('id' in value || 'uid' in value || 'type' in value)) {
          if (value.type !== 'checkbox' && value.type !== 'computedValue') {
            stack.push(value);
          }
        }
      }
    }
    if ('inlineNodes' in node) {
      stack.push(...Object.values(node.inlineNodes ?? {}));
    }
  }
  return nodes;
}

test.each([
  { kind: 'Roam', converter: new RoamConverter(), fixture: 'roam/tests/fixtures/smoketest.json' },
  { kind: 'Logseq', converter: new LogseqConverter(), fixture: 'logseq/tests/fixtures/smoketest.json' },
  { kind: 'Workflowy', converter: new WorkflowyConverter(), fixture: 'workflowy/tests/fixtures/smoketest.opml' },
  { kind: 'Evernote', converter: new EvernoteConverter(), fixture: 'evernote/tests/fixtures/smoketest.enex' },
  {
    kind: 'Markdown',
    converter: new MarkdownConverter(fs, path),
    fixture: 'markdown/tests/fixtures/frontmatter/frontmatter.md',
  },
])('$kind writes TIF declarations and references', ({ converter, fixture }) => {
  const file = converter.convert(fs.readFileSync(`src/converters/${fixture}`, 'utf8'));
  if (!file) {
    throw new Error('Expected a converted file');
  }
  expect(file.version).toBe('TanaIntermediateFile V2.1');
  expect(Object.keys(file)).toEqual(['version', 'contents']);
  const nodes = descendants(file);
  expect(nodes.length).toBeGreaterThan(1);
  const identities = new Set<string>();
  for (const node of nodes) {
    if (node.type === 'external' || node.isRef) {
      continue;
    }
    const identity = node.id ?? node.uid;
    if (identity) {
      expect(identities.has(identity)).toBe(false);
      identities.add(identity);
    }
    if (node.type === 'field') {
      expect(node).not.toHaveProperty('children');
      expect(node.field).not.toHaveProperty('inlineNodes');
    }
  }
});

function sourceNode(uid: string, name: string, children?: SourceNode[]): SourceNode {
  return { uid, name, children, type: 'node', createdAt: 0, editedAt: 0 };
}
function graph(roots: SourceNode[]): SourceGraph {
  return {
    roots,
    homeIds: roots.map((root) => root.uid),
    summary: { leafNodes: 0, topLevelNodes: roots.length, totalNodes: 0, calendarNodes: 0, fields: 0, brokenRefs: 0 },
  };
}

test('repeated pages are declared at their outline owner and referenced elsewhere', () => {
  const child = sourceNode('child', 'Child');
  const parent = sourceNode('parent', 'Parent', [child]);
  const file = createTifFile(graph([child, parent, sourceNode('other', 'Other', [child])]));
  const nodes = descendants(file);
  expect(
    nodes.filter(
      (entry) =>
        entry.type === 'node' &&
        !entry.isRef &&
        entry.nameParts?.some((part) => part.type === 'text' && part.text === 'Child'),
    ),
  ).toHaveLength(1);
  expect(nodes.filter((entry) => entry.isRef)).toHaveLength(1);
});

test('inline formatting, literal code, and mention aliases survive conversion', () => {
  const file = createTifFile(
    graph([sourceNode('target', 'Target'), sourceNode('note', '<b>Read</b> [short]([[target]]) and `[[literal]]`')]),
  );
  const note = file.contents.workspace?.children?.[1];
  expect(note).toMatchObject({
    nameParts: [
      { type: 'text', text: 'Read', formats: ['bold'] },
      { type: 'text', text: ' ' },
      { type: 'node', nodeId: expect.any(String) },
      { type: 'text', text: ' and ' },
      { type: 'text', text: '[[literal]]', formats: ['code'] },
    ],
    inlineNodes: { [file.contents.workspace?.children?.[0].id ?? 'missing']: { isRef: true, alias: 'short' } },
  });
});

test.each([false, true])('mention wrappers stay distinct from their sibling target, forward=%s', (forward) => {
  const target = sourceNode('target', 'Target');
  const mentions = [sourceNode('first', '[[target]]'), sourceNode('second', '[[target]]')];
  const children = forward ? [...mentions, target] : [target, ...mentions];
  const file = createTifFile(graph([sourceNode('parent', 'Parent', children)]));
  const parent = file.contents.workspace?.children?.[0];
  if (parent?.type !== 'node') {
    throw new Error('Expected parent');
  }
  expect(parent.children).toHaveLength(3);
  expect(new Set(parent.children?.map((child) => child.id)).size).toBe(3);
});

test('unresolved bracket text stays literal in a source without wiki links', () => {
  const file = new WorkflowyConverter().convert(
    '<opml version="2.0"><body><outline text="Examples use [[Page]] syntax"/></body></opml>',
  );
  expect(file?.contents.workspace?.children?.[0]).toMatchObject({
    nameParts: [
      { type: 'text', text: 'Examples use ' },
      { type: 'text', text: '[[Page]]' },
      { type: 'text', text: ' syntax' },
    ],
  });
});

test('Markdown formatting and encoded text survive structured names', () => {
  const file = createTifFile(graph([sourceNode('text', '**Bold** and &amp;lt;em&amp;gt; and `**literal**`')]));
  expect(file.contents.workspace?.children?.[0]).toMatchObject({
    nameParts: [
      { type: 'text', text: 'Bold', formats: ['bold'] },
      { type: 'text', text: ' and &amp;lt;em&amp;gt; and ' },
      { type: 'text', text: '**literal**', formats: ['code'] },
    ],
  });
});

test('a later mention with a different alias stays literal', () => {
  const file = createTifFile(
    graph([sourceNode('target', 'Target'), sourceNode('text', '[[target]] then [label]([[target]])')]),
  );
  const entry = file.contents.workspace?.children?.[1];
  expect(entry).toMatchObject({
    nameParts: [{ type: 'node' }, { type: 'text', text: ' then ' }, { type: 'text', text: '[label]([[target]])' }],
  });
  expect(entry && 'inlineNodes' in entry ? Object.values(entry.inlineNodes ?? {}) : []).toEqual([]);
});

test('a mention wrapper keeps its checkbox', () => {
  const file = createTifFile(
    graph([sourceNode('target', 'Target'), { ...sourceNode('todo', '[[target]]'), todoState: 'todo' }]),
  );
  expect(file.contents.workspace?.children?.[1]).toMatchObject({
    type: 'node',
    isDone: false,
    nameParts: [{ type: 'node' }],
  });
});
