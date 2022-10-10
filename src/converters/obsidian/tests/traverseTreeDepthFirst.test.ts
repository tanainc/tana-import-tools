import { expect, test } from '@jest/globals';
import { HeadingNode } from '../filterHeadingLinks';
import { traverseTreeDepthFirst } from '../traverseTreeDepthFirst';

test('traverseTreeBreadthFirst test', () => {
  //sinlge heading works
  const singleNode = {
    uid: '1',
    content: '1',
  };
  expect(traverseTreeDepthFirst([singleNode], ['1'])).toBe(singleNode);

  //simple 1-2 headings work
  let targetNode: HeadingNode = {
    uid: '2',
    content: '2',
  };
  let tree: HeadingNode = {
    uid: '1',
    content: '1',
    children: [targetNode],
  };
  expect(traverseTreeDepthFirst([tree], ['1', '2'])).toBe(targetNode);
  expect(traverseTreeDepthFirst([tree], ['1', '2', '3'])).toBe(null);
  expect(traverseTreeDepthFirst([tree], ['2', '1'])).toBe(null);

  //skipping a node works
  targetNode = {
    uid: '3',
    content: '3',
  };
  tree = {
    uid: '1',
    content: '1',
    children: [{ uid: '2', content: '2', children: [targetNode] }],
  };
  expect(traverseTreeDepthFirst([tree], ['1', '3'])).toBe(targetNode);

  //parallel node with same content but not first in array works
  targetNode = {
    uid: '3',
    content: '3',
  };
  tree = {
    uid: '1',
    content: '1',
    children: [{ uid: '2', content: '2', children: [targetNode, { uid: 'NOT_THIS', content: '3' }] }],
  };
  expect(traverseTreeDepthFirst([tree], ['1', '3'])).toBe(targetNode);

  //parallel node with same partial part but in different subtree works
  targetNode = {
    uid: '4',
    content: '4',
  };
  tree = {
    uid: '1',
    content: '1',
    children: [
      //the first child will be preferred
      {
        uid: '2',
        content: '2',
        children: [
          {
            uid: '3',
            content: '3',
            children: [targetNode],
          },
        ],
      },
      {
        uid: 'NOT_THIS',
        content: 'NOT_2',
        children: [
          {
            uid: 'NOT_3',
            content: '3',
            children: [
              {
                uid: 'NOT_4',
                content: '4',
              },
            ],
          },
        ],
      },
    ],
  };
  expect(traverseTreeDepthFirst([tree], ['1', '3', '4'])).toBe(targetNode);

  //skipping levels multiple times works
  targetNode = {
    uid: '5',
    content: '5',
  };
  tree = {
    uid: '1',
    content: '1',
    children: [
      {
        uid: '2',
        content: '2',
        children: [
          {
            uid: '3',
            content: '3',
            children: [
              {
                uid: '4',
                content: '4',
                children: [targetNode],
              },
            ],
          },
        ],
      },
    ],
  };
  expect(traverseTreeDepthFirst([tree], ['1', '3', '5'])).toBe(targetNode);

  //path that is lower but in earlier subtree is preferred
  targetNode = {
    uid: '2',
    content: '2',
  };
  expect(
    traverseTreeDepthFirst(
      [
        {
          uid: '1',
          content: '1',
          children: [targetNode],
        },
        { uid: '3', content: '2' },
      ],
      ['2'],
    ),
  ).toBe(targetNode);
});
