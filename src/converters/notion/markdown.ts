import * as mdast from 'mdast-util-from-markdown';
import type { Paragraph, Link, Text, Heading } from 'mdast-util-from-markdown/lib';
import { TanaIntermediateNode } from '../../types/types';
import { idgenerator } from '../../utils/utils';
import merge from 'lodash.merge';
import takeWhile from 'lodash.takewhile';

const createNode = (name: string): TanaIntermediateNode => {
  return {
    uid: idgenerator(),
    name,
    createdAt: new Date().getTime(),
    editedAt: new Date().getTime(),
    type: 'node',
    todoState: undefined,
  };
};

const ignoreList = ['thematicBreak'];

const parentNode = ['heading', 'list'];

const parseText = (text: Text) => {
  return createNode(text.value);
};

const parseLink = (link: Link) => {
  const url = link.url;
  const child = link.children.at(0);

  if (child?.type === 'text') {
    return createNode(`[${child.value}](${url})`);
  }

  return createNode(url);
};

const parseParagraph = (paragraph: Paragraph) => {
  const [child] = paragraph.children;

  if (child.type === 'text') {
    return parseText(child);
  } else if (child.type === 'link') {
    return parseLink(child);
  }

  console.error(`Paragraph child type not supported ${child.type}`);
};

const parseHeading = (heading: Heading) => {
  const [child] = heading.children;

  if (child.type === 'text') {
    return parseText(child);
  }

  console.error(`Heading child type not supported ${child.type}`);
};

type Accumulator = {
  rootNodePath: { level: number; uid: string }[];
  rootNodeOrder: string[];
  nodes: Record<string, TanaIntermediateNode>;
  nodeUidToChildren: Record<string, string[]>;
};

const nestNormalizedNodes = (nodes: Record<string, TanaIntermediateNode>, nodeChildren: Record<string, string[]>) => {
  const nestedNodes = Object.keys(nodeChildren).reduce((acc, parentNodeKey) => {
    const node = acc[parentNodeKey];
    const children = nodeChildren[parentNodeKey].map((childKey) => acc[childKey]);
    return merge(acc, { [parentNodeKey]: { ...node, children } });
  }, nodes);

  const uidsToRemove = Object.values(nodeChildren).flat();

  return Object.values(nestedNodes).filter((node) => !uidsToRemove.includes(node.uid));
};

export const mdToTana = (fileContent: string) => {
  const ast = mdast.fromMarkdown(fileContent);

  const { rootNodeOrder, nodes, nodeUidToChildren } = ast.children.reduce(
    (acc, curr) => {
      if (ignoreList.includes(curr.type)) {
        return acc;
      }

      let newNode;
      let parentNodeUid;
      if (curr.type === 'paragraph') {
        parentNodeUid = acc.rootNodePath.at(-1)?.uid;
        newNode = parseParagraph(curr);
        if (!newNode) {
          return acc;
        }
      } else if (curr.type === 'heading') {
        newNode = parseHeading(curr);
        if (!newNode) {
          return acc;
        }

        const lastNode = acc.rootNodePath.at(-1);
        console.log(acc.rootNodePath);
        if (!lastNode) {
          acc.rootNodePath.push({ level: curr.depth, uid: newNode.uid });
        } else if (lastNode.level === curr.depth) {
          const newRootNodePath = acc.rootNodePath.filter((_, i) => {
            return i !== acc.rootNodePath.length - 1;
          });
          parentNodeUid = newRootNodePath[-1]?.uid;
          acc.rootNodePath = [...newRootNodePath, { level: curr.depth, uid: newNode.uid }];
        } else if (lastNode.level > curr.depth) {
          const newRootNodePath = takeWhile(acc.rootNodePath, ({ level }) => level < curr.depth);
          parentNodeUid = acc.rootNodePath[-1].uid;
          acc.rootNodePath = [...newRootNodePath, { level: curr.depth, uid: newNode.uid }];
        }
      }

      if (!newNode) {
        return acc;
      }

      acc.nodes[newNode.uid] = newNode;

      if (parentNodeUid) {
        acc.nodeUidToChildren[parentNodeUid] = [...(acc.nodeUidToChildren[parentNodeUid] ?? []), newNode.uid];
      } else {
        acc.rootNodeOrder.push(newNode.uid);
      }

      return acc;
    },
    {
      headingLevelPath: [],
      rootNodePath: [],
      rootNodeOrder: [],
      nodes: {},
      nodeUidToChildren: {},
    } as Accumulator,
  );

  const nestedNodes = nestNormalizedNodes(nodes, nodeUidToChildren);

  return nestedNodes;
};
