import { marked } from 'marked';
import { TanaIntermediateNode } from '../../types/types';
import { idgenerator } from '../../utils/utils';
import merge from 'lodash.merge';
import takeWhile from 'lodash.takewhile';
import last from 'lodash.last';

const lexer = new marked.Lexer();

type CreateNodeArgs = {
  name: string;
  todoState?: 'done' | 'todo';
};
const createNode = ({ name, todoState }: CreateNodeArgs): TanaIntermediateNode => {
  return {
    uid: idgenerator(),
    name,
    createdAt: new Date().getTime(),
    editedAt: new Date().getTime(),
    type: 'node',
    todoState,
  };
};

const parseToken = (token: marked.Token): string | undefined => {
  switch (token.type) {
    case 'em': {
      return `__${parseTokens(token.tokens)}__`;
    }
    case 'text': {
      return token.text;
    }
    case 'link': {
      return `[${parseTokens(token.tokens)}](${token.href})`;
    }
    case 'heading': {
      return parseTokens(token.tokens);
    }
    case 'paragraph': {
      return parseTokens(token.tokens);
    }
    case 'list': {
      console.log(token.items[0], token.items[0].tokens);
    }
  }
};

const createListNode = (list: marked.Tokens.List): TanaIntermediateNode[] => {
  return list.items.map(({ task, checked, tokens }) => {
    const result = parseTokens(tokens);
    const todoState: 'done' | 'todo' | undefined = task ? (checked ? 'done' : 'todo') : undefined;
    return createNode({ name: result, todoState });
  });
};

function parseTokens(tokens: marked.Token[]) {
  const result = tokens.map(parseToken);

  return result.join();
}

type NodePathItem = {
  depth: number;
  uid: string;
};

type Accumulator = {
  rootNodePath: NodePathItem[];
  rootNodeOrder: string[];
  nodes: Record<string, TanaIntermediateNode>;
  nodeUidToChildren: Record<string, string[]>;
};

const nestChild = (
  nodeUid: string,
  nodes: Record<string, TanaIntermediateNode>,
  nodeParentToChildren: Record<string, string[]>,
): TanaIntermediateNode => {
  const node = nodes[nodeUid];
  const childrenKeys = nodeParentToChildren[nodeUid];
  const children = childrenKeys?.map((childUid) => nestChild(childUid, nodes, nodeParentToChildren));
  return {
    ...node,
    children,
  };
};

const nestNormalizedNodes = (nodes: Record<string, TanaIntermediateNode>, nodeChildren: Record<string, string[]>) => {
  const nestedNodes = Object.keys(nodeChildren).reduce((acc, parentNodeKey) => {
    const node = acc[parentNodeKey];
    const children = nodeChildren[parentNodeKey].map((childKey) => nestChild(childKey, nodes, nodeChildren));
    return merge(acc, { [parentNodeKey]: { ...node, children } });
  }, nodes);

  const uidsToRemove = Object.values(nodeChildren).flat();

  return Object.values(nestedNodes).filter((node) => !uidsToRemove.includes(node.uid));
};

const determineRootNodePath = (rootNodePath: NodePathItem[], curr: marked.Token, newNode: TanaIntermediateNode) => {
  const lastNode = last(rootNodePath);
  if (curr.type !== 'heading') {
    return { newRootNodePath: rootNodePath, parentNodeUid: lastNode?.uid };
  }

  if (!lastNode) {
    return { newRootNodePath: [{ depth: curr.depth, uid: newNode.uid }], parentNodeUid: null };
  } else if (lastNode.depth === curr.depth) {
    const newRootNodePath = rootNodePath.filter((_, i) => {
      return i !== rootNodePath.length - 1;
    });
    return {
      newRootNodePath: [...newRootNodePath, { depth: curr.depth, uid: newNode.uid }],
      parentNodeUid: curr.depth === 1 ? null : lastNode.uid,
    };
  } else if (lastNode.depth > curr.depth) {
    const newRootNodePath = takeWhile(rootNodePath, ({ depth }) => depth < curr.depth);
    const parentNodeUid = last(newRootNodePath)?.uid;
    return {
      newRootNodePath: [...newRootNodePath, { depth: curr.depth, uid: newNode.uid }],
      parentNodeUid,
    };
  } else if (lastNode.depth < curr.depth) {
    return { newRootNodePath: [...rootNodePath, { depth: curr.depth, uid: newNode.uid }], parentNodeUid: lastNode.uid };
  }

  return { newRootNodePath: rootNodePath, parentNodeUid: lastNode.uid };
};

export const mdToTana = (fileContent: string) => {
  const tokens = lexer.lex(fileContent);

  const { rootNodeOrder, nodes, nodeUidToChildren } = tokens.reduce(
    (acc, curr) => {
      if (curr.type === 'space' || curr.type === 'hr' || curr.type === 'br' || curr.type === 'escape') {
        return acc;
      }

      const newNodes: TanaIntermediateNode[] = [];
      if (curr.type === 'list') {
        newNodes.push(...createListNode(curr));
      } else {
        const result = parseToken(curr);

        if (!result) {
          return acc;
        }

        newNodes.push(createNode({ name: result }));
      }

      if (newNodes.length === 0) {
        return acc;
      }

      const { parentNodeUid, newRootNodePath } = determineRootNodePath(acc.rootNodePath, curr, newNodes[0]);

      newNodes.forEach((node) => {
        acc.nodes[node.uid] = node;
        if (parentNodeUid) {
          acc.nodeUidToChildren[parentNodeUid] = [...(acc.nodeUidToChildren[parentNodeUid] ?? []), node.uid];
        } else {
          acc.rootNodeOrder.push(node.uid);
        }
      });

      return { ...acc, rootNodePath: newRootNodePath };
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
