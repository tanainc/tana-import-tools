import { TanaIntermediateNode, TanaIntermediateSummary } from '../../types/types';
import { getBracketLinks, idgenerator } from '../../utils/utils';
import { HierarchyType, MarkdownNode, extractMarkdownNodes } from './markdown/extractMarkdownNodes';
import { VaultContext } from './VaultContext';

function createChildNode(obsidianNode: MarkdownNode, today: number, idGenerator: IdGenerator): TanaIntermediateNode {
  return {
    uid: idGenerator(),
    name: obsidianNode.content,
    createdAt: today,
    editedAt: today,
    type: 'node',
  };
}

export function createFileNode(displayName: string, today: number, context: VaultContext): TanaIntermediateNode {
  return { uid: context.getUid(displayName), name: displayName, createdAt: today, editedAt: today, type: 'node' };
}

export type IdGenerator = () => string;

export function convertObsidianFile(
  fileName: string, //without ending
  fileContent: string,
  context: VaultContext = new VaultContext(),
  today: number = Date.now(),
  idGenerator: IdGenerator = idgenerator,
): [TanaIntermediateNode, TanaIntermediateSummary, string[]] {
  let newPages: string[] = [];
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

  const rootNode = createFileNode(displayName, today, context);
  context.summary.topLevelNodes++;

  context.summary.leafNodes += obsidianNodes.length;
  context.summary.totalNodes += 1 + obsidianNodes.length;
  //TODO: broken refs

  const lastObsidianNodes: MarkdownNode[] = [{ type: HierarchyType.ROOT, level: -1 } as MarkdownNode];
  const lastTanaNodes = [rootNode];

  for (const node of obsidianNodes) {
    const childNode = createChildNode(node, today, idGenerator);
    processRawTanaNode(childNode);
    if (childNode.refs) {
      newPages.push(...childNode.refs);
    }
    insertNodeIntoHierarchy(childNode, node, lastObsidianNodes, lastTanaNodes);
  }

  return [rootNode, context.summary, newPages];
}

function processRawTanaNode(tanaNode: TanaIntermediateNode) {
  //TODO: links to headings [[..#..]] / blocks [[filename#^dcf64c]]
  //TODO: aliases
  //TODO: convert to different node types, remove markdown formatting etc.
  const n = tanaNode.name;
  tanaNode.name = tanaNode.name.replace('collapsed:: true', '').replace(/^#+ /, '').trim();
  // links with alias
  tanaNode.name = tanaNode.name.replace(/\[\[([^|]+)\|([^\]]+)\]\]/g, '[$1]([[$2]])');
  // links with anchor, just remove anchor for now
  tanaNode.name = tanaNode.name.replace(/\[\[([^#]+)#([^#\]]+)\]\]/g, '[[$1]]');
  // tags, convert to links for now
  tanaNode.name = tanaNode.name.replace(/(?:\s|^)(#([^\[]]+?))(?:(?=\s)|$)/g, ' #[[$2]]');

  //TODO: replace with correct UIDs
  const foundUids = getBracketLinks(tanaNode.name, true);

  if (foundUids.length > 0) {
    tanaNode.refs = foundUids;
  }
}

function insertNodeIntoHierarchy(
  tanaNode: TanaIntermediateNode,
  obsidianNode: MarkdownNode,
  lastObsidianNodes: MarkdownNode[],
  lastTanaNodes: TanaIntermediateNode[],
) {
  //once the non-parent nodes are removed, the next one is the parent
  removeNonParentNodes(obsidianNode, lastObsidianNodes, lastTanaNodes);
  let lastObsidianNode = lastObsidianNodes[lastObsidianNodes.length - 1];
  let lastTanaNode = lastTanaNodes[lastTanaNodes.length - 1];
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
  if (potentialParent.type === HierarchyType.ROOT) return true;

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
