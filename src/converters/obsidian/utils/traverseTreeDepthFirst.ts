/**
 * Traverses the given tree by following the content-path. Supports skipping levels in the path.
 *
 * The approach is depth first. In Obsidian higher nodes come always first - if the path is correct.
 * So if we have:
 *
 * # test
 * ## test2
 * ### test3
 *
 * # test4
 * ## test3
 *
 * And if we link [[...#test3]] the first test3 will be taken.
 * This is even true if the heading is lower than a later one:
 *
 * # test
 * ## test2
 * ### test3
 *
 * # test2
 *
 * [[...#test2]] links to the first test2.
 *
 */
export function traverseTreeDepthFirst<Node extends { children?: Node[]; content: string }>(
  nodes: Node[], //this is primarily used for the Heading Tree and that does not necessarily have one root node, so we support multiples
  contentPath: string[],
): Node | null {
  for (const node of nodes) {
    let pathLeft = contentPath.slice();
    if (node.content === contentPath[0]) {
      pathLeft = contentPath.slice(1);
    }
    if (pathLeft.length === 0) {
      return node;
    }
    if (node.children) {
      const res = traverseTreeDepthFirst(node.children, pathLeft);
      if (res) {
        return res;
      }
    }
  }
  return null;
}
