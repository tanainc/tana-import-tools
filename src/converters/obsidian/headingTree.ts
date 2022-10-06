import { HierarchyType, MarkdownNode } from './extractMarkdownNodes';
import { VaultContext } from './VaultContext';

interface Heading {
  /**
   * The level is only there if the heading was generated from the markdown nodes.
   * We use this knowledge to collect non-existing heading links later and to validate the the positions of the first estimated headings.
   */
  level?: number;
  uid: string;
  content: string;
}

/**
 * If no heading tree exists (so no other heading link was found before this file was processed),
 * we create the definitive heading tree from the markdown nodes.
 *
 * @param headingNodes the heading nodes of the current file
 * @param tanaNodeUidMap a map from node content to UID.
 * @returns
 */
export function markdownNodesToHeadingTree(
  headingNodes: MarkdownNode[],
  tanaNodeUidMap: Map<string, string>,
): Heading[][] {
  return headingNodes.map((node, index, arr) => {
    let level = node.level;
    //normalizing levels for later usage
    //its possible for a ###-heading to be the immediate child of a #-heading
    if (index != 0 && arr[index - 1].level < level) {
      level = arr[index - 1].level + 1;
    }

    return [
      {
        content: node.content,
        level: level,
        uid: tanaNodeUidMap.get(node.content) as string,
      },
    ];
  });
}

export interface FileHeadingTree {
  file: string;
  headingTree: Heading[];
}

/**
 * If no heading tree exists, we create a first estimation from the first given heading link.
 *
 * @param splitHeadingLink is the obisidan link splitted, trimmed and filtered for empty strings.
 */
export function headingLinkToHeadingTree(splitHeadingLink: string[], context: VaultContext): Heading[][] {
  return splitHeadingLink.map((link) => [
    {
      content: link,
      //we know the heading has not been processed yet, so the node has no matching UID
      //each heading node needs to look up the corresponding FileHeadingTree to find out if a UID exists, so this does not need to be added to the UID map
      uid: context.idGenerator(),
    },
  ]);
}

export function isEstimatedTree(tree: Heading[][]) {
  return tree[0][0].level === undefined;
}

/**
 *
 * @param estimatedTree a tree generated from a heading link (might contain UIDs that are no)
 * @param definitiveTree a tree generated from markdown nodes
 * @param reportInvalidLinks function to report invalid reconstructed link (e.g. if headingA#headingC#headingB is found to be impossible)
 * @param reportMarkdownNodeUIDChanges function to report if a UID in the definitive tree was changed - this means we need to also change it in the Tana Node
 * @param estimatedWasFirst if the estimated tree was generated first, we need to transfer all UIDs from it, otherwise the definitive tree is leading in UIDs
 */
export function mergeEstimatedHeadingTreeWithDefinitiveHeadingTree(
  estimatedTree: Heading[][],
  definitiveTree: Heading[][],
  reportInvalidHeadings: (invalidHeadings: Heading[]) => void,
  reportMarkdownNodeUIDChanges: (oldUID: string, newUID: string) => void,
  estimatedWasFirst: boolean,
) {
  for (let index = 0; index < definitiveTree.length; index++) {
    const heading = definitiveTree[index][0];
    const headings = estimatedTree[index];
    if (!headings) {
      break;
    }
    const headingsWithWrongLevel = headings.filter((h) => h.content !== heading.content);
    if (!estimatedTree[index + 1]) {
      estimatedTree[index + 1] = [];
    }
    estimatedTree[index + 1].push(...headingsWithWrongLevel);
    const sameLevel = headings.filter((h) => h.content === heading.content)[0];
    if (sameLevel && estimatedWasFirst) {
      //this is only necessary because the Tana Node is created already if we had an estimated tree at first
      //we could input Tana Nodes or Markdown Nodes, but in that case we would need to keep the Tana / Markdown Node around
      //until another heading link appears which we dont want for memory reasons
      //this way this merge function is reusable no matter which headingTree was created first
      reportMarkdownNodeUIDChanges(heading.uid, sameLevel.uid);
      heading.uid = sameLevel.uid;
    }
  }

  //we push non-fitting headings continiously down the tree
  //this means if some are at the end here, they are invalid
  //we can not reconstruct what the origianl heading link (we only now headingA#headingB => headingB)
  //but that should be enough for the user, no need to implement full obsidian link correction
  if (estimatedTree.length > definitiveTree.length) {
    reportInvalidHeadings(estimatedTree.slice(definitiveTree.length).flat());
  }

  return definitiveTree;
}

//TODO: count headings that are not found in the statistics
//TODO: include the file in the invalid headings-node
