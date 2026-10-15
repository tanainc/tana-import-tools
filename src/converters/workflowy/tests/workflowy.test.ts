import { expect, test } from 'vitest';
import { SourceNode, SourceGraph } from '../../sourceGraph.js';
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

  const maskNode = (node: SourceNode): unknown => ({
    ...node,
    uid: maskUid(node.uid),
    createdAt: '<time>',
    editedAt: '<time>',
    children: node.children?.map(maskNode),
  });

  const maskFile = (file: SourceGraph) => ({
    ...file,
    roots: file.roots.map(maskNode),
    homeIds: file.homeIds?.map(maskUid),
  });

  return { maskFile };
}

test('OPML source snapshot', () => {
  const [file] = importWorkflowyFile('smoketest.opml');
  const { maskFile } = createMasker();

  expect(maskFile(file)).toMatchInlineSnapshot(`
    {
      "homeIds": [
        "x1",
        "x4",
        "x6",
        "x7",
        "x8",
      ],
      "roots": [
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
    }
  `);
});

test('homeIds matches top-level node UIDs', () => {
  const [file] = importWorkflowyFile('smoketest.opml');

  expect(file.homeIds).toHaveLength(5);
  expect(file.roots.map((n) => n.uid)).toEqual(file.homeIds);
});
