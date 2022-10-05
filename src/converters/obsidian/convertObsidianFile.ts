import { TanaIntermediateNode } from '../../types/types';
import { convertMarkdownNode } from './convertMarkdownNode';
import { HierarchyType, MarkdownNode, extractMarkdownNodes } from './extractMarkdownNodes';
import { UidRequestType, VaultContext } from './VaultContext';

export function convertObsidianFile(
  fileName: string, //without ending
  fileContent: string,
  context: VaultContext,
  today: number = Date.now(),
) {
  let obsidianNodes = extractMarkdownNodes(fileContent);
  let displayName = fileName;
  const name = obsidianNodes[0] && obsidianNodes[0].content.match(/^title::(.+)$/);
  if (name) {
    displayName = name[1];
    obsidianNodes = obsidianNodes.slice(1);
  }

  // common in Obsidian to repeat the filename in the first line, remove first line if so
  if (obsidianNodes[0] && obsidianNodes[0].content.replace(/^#+/, '').trim() === displayName.trim()) {
    obsidianNodes = obsidianNodes.slice(1);
  }

  const fileNode = createFileNode(displayName, today, context);

  context.summary.leafNodes += obsidianNodes.length;
  context.summary.totalNodes += obsidianNodes.length;
  //TODO: broken refs

  const lastObsidianNodes: MarkdownNode[] = [{ type: HierarchyType.ROOT, level: -1 } as MarkdownNode];
  const lastTanaNodes = [fileNode];
  for (const node of obsidianNodes) {
    const childNode = convertMarkdownNode(node, today, context);
    insertNodeIntoHierarchy(childNode, node, lastObsidianNodes, lastTanaNodes);
  }

  return fileNode;
}

function createFileNode(displayName: string, today: number, context: VaultContext): TanaIntermediateNode {
  return {
    uid: context.uidRequest(displayName, UidRequestType.FILE),
    name: displayName,
    createdAt: today,
    editedAt: today,
    type: 'node',
  };
}

function insertNodeIntoHierarchy(
  tanaNode: TanaIntermediateNode,
  obsidianNode: MarkdownNode,
  lastObsidianNodes: MarkdownNode[],
  lastTanaNodes: TanaIntermediateNode[],
) {
  //once the non-parent nodes are removed, the next one is the parent
  removeNonParentNodes(obsidianNode, lastObsidianNodes, lastTanaNodes);
  const lastObsidianNode = lastObsidianNodes[lastObsidianNodes.length - 1];
  const lastTanaNode = lastTanaNodes[lastTanaNodes.length - 1];
  if (lastObsidianNode && lastTanaNode) {
    lastTanaNode.children = lastTanaNode.children ?? [];
    lastTanaNode.children.push(tanaNode);
  }
  lastObsidianNodes.push(obsidianNode);
  lastTanaNodes.push(tanaNode);
}

function removeNonParentNodes(
  obsidianNode: MarkdownNode,
  lastObsidianNodes: MarkdownNode[],
  lastTanaNodes: TanaIntermediateNode[],
) {
  let lastObsidianNode = lastObsidianNodes[lastObsidianNodes.length - 1];
  let lastTanaNode = lastTanaNodes[lastTanaNodes.length - 1];
  while (lastObsidianNode && lastTanaNode && !isChild(lastObsidianNode, obsidianNode)) {
    lastObsidianNodes.pop();
    lastTanaNodes.pop();
    lastObsidianNode = lastObsidianNodes[lastObsidianNodes.length - 1];
    lastTanaNode = lastTanaNodes[lastTanaNodes.length - 1];
  }
}

function isChild(potentialParent: MarkdownNode, potentialChild: MarkdownNode) {
  if (potentialParent.type === HierarchyType.ROOT) {
    return true;
  }

  //HEADING is always a parent of non-headings
  if (potentialParent.type === HierarchyType.HEADING && potentialChild.type !== HierarchyType.HEADING) {
    return true;
  }

  //PARAGRAPH can only be child of HEADING and can not be a parent
  if (potentialParent.type === HierarchyType.PARAGRAPH || potentialChild.type === HierarchyType.PARAGRAPH) {
    return false;
  }

  if (potentialParent.type === potentialChild.type) {
    return potentialParent.level < potentialChild.level;
  }

  return false;
}
