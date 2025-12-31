import { expect, test } from 'vitest';
import { TanaIntermediateNode, TanaIntermediateFile } from '../../../types/types.js';
import { importWorkflowyFile } from './testUtils.js';

function createMasker() {
  const uidMap = new Map<string, string>();
  let counter = 0;

  const maskUid = (uid: string) => {
    if (!uidMap.has(uid)) {
      uidMap.set(uid, `x${++counter}`);
    }
    return uidMap.get(uid)!;
  };

  const maskNode = (node: TanaIntermediateNode): unknown => ({
    ...node,
    uid: maskUid(node.uid),
    createdAt: '<time>',
    editedAt: '<time>',
    children: node.children?.map(maskNode),
  });

  const maskFile = (file: TanaIntermediateFile) => ({
    ...file,
    nodes: file.nodes.map(maskNode),
    homeNodeIds: file.homeNodeIds?.map(maskUid),
  });

  return { maskFile };
}

test('TIF output snapshot', () => {
  const [file] = importWorkflowyFile('smoketest.opml');
  const { maskFile } = createMasker();

  expect(maskFile(file)).toMatchInlineSnapshot(`
    {
      "homeNodeIds": [
        "x1",
        "x4",
        "x6",
        "x7",
        "x8",
      ],
      "nodes": [
        {
          "children": [
            {
              "children": [],
              "createdAt": "<time>",
              "description": undefined,
              "editedAt": "<time>",
              "name": "Good",
              "todoState": undefined,
              "type": "node",
              "uid": "x2",
            },
            {
              "children": [],
              "createdAt": "<time>",
              "description": undefined,
              "editedAt": "<time>",
              "name": "Great",
              "todoState": undefined,
              "type": "node",
              "uid": "x3",
            },
          ],
          "createdAt": "<time>",
          "description": "Some note here",
          "editedAt": "<time>",
          "name": "Hello how are you",
          "todoState": undefined,
          "type": "node",
          "uid": "x1",
        },
        {
          "children": [
            {
              "children": [],
              "createdAt": "<time>",
              "description": undefined,
              "editedAt": "<time>",
              "name": "<a href="https://www.vg.no/">alias here</a>",
              "todoState": undefined,
              "type": "node",
              "uid": "x5",
            },
          ],
          "createdAt": "<time>",
          "description": undefined,
          "editedAt": "<time>",
          "name": "LinkNode",
          "todoState": undefined,
          "type": "node",
          "uid": "x4",
        },
        {
          "children": [],
          "createdAt": "<time>",
          "description": undefined,
          "editedAt": "<time>",
          "name": "Todo1",
          "todoState": "done",
          "type": "node",
          "uid": "x6",
        },
        {
          "children": [],
          "createdAt": "<time>",
          "description": undefined,
          "editedAt": "<time>",
          "name": "Todo2",
          "todoState": "done",
          "type": "node",
          "uid": "x7",
        },
        {
          "children": [],
          "createdAt": "<time>",
          "description": undefined,
          "editedAt": "<time>",
          "name": "Todo3",
          "todoState": "done",
          "type": "node",
          "uid": "x8",
        },
      ],
      "summary": {
        "brokenRefs": 0,
        "calendarNodes": 0,
        "fields": 0,
        "leafNodes": 6,
        "topLevelNodes": 5,
        "totalNodes": 8,
      },
      "version": "TanaIntermediateFile V0.1",
    }
  `);
});

test('homeNodeIds matches top-level node UIDs', () => {
  const [file] = importWorkflowyFile('smoketest.opml');

  expect(file.homeNodeIds).toHaveLength(5);
  expect(file.nodes.map((n) => n.uid)).toEqual(file.homeNodeIds);
});
