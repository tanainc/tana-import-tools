/**
 * Create a tree by converting source-nodes into a target format and inserting them into the hierarchy.
 */
export function createTree<Source, Target extends { children?: Target[] }>(
  targetRoot: Target,
  sourceRoot: Source,
  sources: Source[],
  isChildCheck: (a: Source, b: Source) => boolean,
  conversion: (a: Source) => Target,
  postInsertionHook?: (target: Target, source: Source) => void,
) {
  const lastSourceNodes: Source[] = [sourceRoot];
  const lastTargetNodes = [targetRoot];
  for (const node of sources) {
    const childNode = conversion(node);
    insertNodeIntoHierarchy(childNode, node, lastSourceNodes, lastTargetNodes, isChildCheck);
    postInsertionHook?.(childNode, node);
  }
}

function insertNodeIntoHierarchy<Source, Target extends { children?: Target[] }>(
  targetNode: Target,
  sourceNode: Source,
  lastSourceNodes: Source[],
  lastTargetNodes: Target[],
  isChildCheck: (a: Source, b: Source) => boolean,
) {
  //once the non-parent nodes are removed, the next one is the parent
  removeNonParentNodes(sourceNode, lastSourceNodes, lastTargetNodes, isChildCheck);
  const lastSourceNode = lastSourceNodes[lastSourceNodes.length - 1];
  const lastTargetNode = lastTargetNodes[lastTargetNodes.length - 1];
  if (lastSourceNode && lastTargetNode) {
    lastTargetNode.children = lastTargetNode.children ?? [];
    lastTargetNode.children.push(targetNode);
  }
  lastSourceNodes.push(sourceNode);
  lastTargetNodes.push(targetNode);
}

function removeNonParentNodes<Source, Target extends { children?: Target[] }>(
  sourceNode: Source,
  lastSourceNodes: Source[],
  lastTargetNodes: Target[],
  isChildCheck: (a: Source, b: Source) => boolean,
) {
  let lastSourceNode = lastSourceNodes[lastSourceNodes.length - 1];
  let lastTargetNode = lastTargetNodes[lastTargetNodes.length - 1];
  while (lastSourceNode && lastTargetNode && !isChildCheck(lastSourceNode, sourceNode)) {
    lastSourceNodes.pop();
    lastTargetNodes.pop();
    lastSourceNode = lastSourceNodes[lastSourceNodes.length - 1];
    lastTargetNode = lastTargetNodes[lastTargetNodes.length - 1];
  }
}
