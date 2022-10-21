import { TanaIntermediateAttribute, TanaIntermediateFile, TanaIntermediateNode } from '../../types/types';

export const isPageLink = (s: string) => {
  return !!s.match(/\.md$/);
};

const countChildDecendents = (node: TanaIntermediateNode): number => {
  if (!node.children) {
    return 0;
  }

  return 1 + node.children.map(countChildDecendents).reduce((acc, cur) => acc + cur);
};

const countTotalNodes = (nodes: TanaIntermediateNode[]): number => {
  const count = nodes.length;
  const childrenCount = nodes.map(countChildDecendents).reduce((acc, curr) => acc + curr, 0);

  return count + childrenCount;
};

const isField = (node: TanaIntermediateNode) => node.type === 'field';

const countFields = (nodes: TanaIntermediateNode[]): number => {
  const count = nodes
    .map((node) => {
      let fieldCount = 0;
      if (isField(node)) {
        fieldCount += 1;
      }
      return fieldCount + (node.children ? countFields(node.children) : 0);
    })
    .reduce((acc, curr) => acc + curr, 0);

  return count;
};

const countBrokenLinks = (nodes: TanaIntermediateNode[]): number => {
  return nodes
    .map((node) => {
      let count = 0;
      if (isPageLink(node.name)) {
        count += 1;
      }
      return count + (node.children ? countBrokenLinks(node.children) : 0);
    })
    .reduce((acc, curr) => acc + curr, 0);
};

const countLeafNodes = (nodes: TanaIntermediateNode[]) => {
  return nodes.map(countChildDecendents).reduce((acc, curr) => acc + curr);
};

const createSummary = (nodes: TanaIntermediateNode[]) => {
  return {
    leafNodes: countLeafNodes(nodes),
    calendarNodes: 0,
    fields: countFields(nodes),
    brokenRefs: countBrokenLinks(nodes),
    topLevelNodes: nodes.length,
    totalNodes: countTotalNodes(nodes),
  };
};

type AttributesMap = Record<string, TanaIntermediateAttribute>;

const updateAttribute = (attributesMap: AttributesMap, node: TanaIntermediateNode): AttributesMap => {
  const oldAttribute = attributesMap[node.name] ?? { name: node.name, values: [], count: 0 };
  const newValues = node.children?.map((child) => child.name) ?? [];
  const newValueCount = newValues.length;

  return {
    ...attributesMap,
    [node.name]: {
      ...oldAttribute,
      count: oldAttribute.count + newValueCount,
      values: [...new Set(oldAttribute.values.concat(newValues))],
    },
  };
};

const mergeAttributes = (a: AttributesMap, b: AttributesMap): AttributesMap => {
  return Object.values(b).reduce((acc, curr) => {
    const old = acc[curr.name];

    if (!old) {
      return {
        ...acc,
        [curr.name]: curr,
      };
    }

    const newPatch = {
      count: old.count + curr.count,
      values: [...new Set(old.values.concat(curr.values))],
    };

    return {
      ...acc,
      [curr.name]: {
        ...old,
        ...newPatch,
      },
    };
  }, a);
};

const createAttributesMap = (nodes: TanaIntermediateNode[]): AttributesMap => {
  const attributesMap = nodes.reduce((attributesAcc, node) => {
    if (isField(node)) {
      attributesAcc = updateAttribute(attributesAcc, node);
    }

    const childrenAttributes = node.children ? createAttributesMap(node.children) : {};
    return mergeAttributes(attributesAcc, childrenAttributes);
  }, {} as AttributesMap);

  return attributesMap;
};

const createAttributes = (nodes: TanaIntermediateNode[]): TanaIntermediateAttribute[] =>
  Object.values(createAttributesMap(nodes));

export const normalizeNodes = (nodes: TanaIntermediateNode[]) => {
  return nodes.reduce((acc, curr) => {
    acc[curr.name] = curr;
    return acc;
  }, {} as Record<TanaIntermediateAttribute['name'], TanaIntermediateNode>);
};

const getNameOutOfLink = (link: string) => {
  return decodeURIComponent(link.replace(/%20[0-9a-f]{32}|\.md$/g, ''))
    .split('/')
    .at(-1);
};

export const fixPageLinks = (
  nodeMap: Record<TanaIntermediateAttribute['name'], TanaIntermediateNode>,
  nodes: TanaIntermediateNode[],
): TanaIntermediateNode[] => {
  return nodes.map((node) => {
    const refs: string[] = [];
    const newName = node.name
      .split(',')
      .map((potentialLink) => {
        if (!isPageLink(potentialLink)) {
          return potentialLink;
        }

        const linkName = getNameOutOfLink(potentialLink);

        if (!linkName || !nodeMap[linkName]) {
          return potentialLink;
        }

        const refFromLink = nodeMap[linkName].uid;

        refs.push(refFromLink);
        return `[[${refFromLink}]]`;
      })
      .join(',');

    const newChildren = node.children ? fixPageLinks(nodeMap, node.children) : undefined;

    return {
      ...node,
      name: newName,
      refs,
      children: newChildren,
    };
  });
};

export const nodesToTanaFile = (nodes: TanaIntermediateNode[]) => {
  const file: TanaIntermediateFile = {
    version: 'TanaIntermediateFile V0.1',
    summary: createSummary(nodes),
    nodes,
    attributes: createAttributes(nodes),
  };

  return file;
};
