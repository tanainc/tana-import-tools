/**
 * Traverses the given tree by following the content-path. Supports skipping levels in the path.
 */
export function traverseTreeBreadthFirst<Node extends { children?: Node[]; content: string }>(
  nodes: Node[], //this is primarily used for the Heading Tree and that does not necessarily have one root node, so we support multiples
  contentPath: string[],
) {
  for (const node of nodes) {
    if (node.content === contentPath[0]) {
      return bfsHelper(node, contentPath.slice(1));
    }
  }
  for (const node of nodes) {
    const foundNode = bfsHelper(node, contentPath.slice());
    if (foundNode) {
      return foundNode;
    }
  }
  return null;
}

function bfsHelper<Node extends { children?: Node[]; content: string }>(
  node: Node,
  contentPath: string[],
): Node | null {
  if (contentPath.length === 0) {
    return node;
  }

  if (node.children) {
    return traverseTreeBreadthFirst(node.children, contentPath.slice());
  }

  return null;
}
