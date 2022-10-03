import { TanaIntermediateFile, TanaIntermediateNode, TanaIntermediateSummary } from '../../types/types';
import { getBracketLinks, idgenerator } from '../../utils/utils';
import { HierarchyType, ObsidianNode, fileContentToNodes } from './obsidianNodes';

function createChildNode(obsidianNode: ObsidianNode, today: number, idGenerator: IdGenerator): TanaIntermediateNode {
  return { uid: idGenerator(), name: obsidianNode.content, createdAt: today, editedAt: today, type: 'node' };
}

export function createFileNode(displayName: string, today: number, uidFinder: UidFinder): TanaIntermediateNode {
  return { uid: uidFinder(displayName), name: displayName, createdAt: today, editedAt: today, type: 'node' };
}

export type IdGenerator = () => string;

/**
 * We can not just take the obsidian link because we might already have created a node for that link.
 * This function should return the correct Uid.
 */
export type UidFinder = (obsidianLink: string) => string;

export function ObsidianSingleFileConverter(fileName: string, fileContent: string): TanaIntermediateFile {
  const [node, summary] = convertObsidianFile(fileName, fileContent) as [
    TanaIntermediateNode,
    TanaIntermediateSummary,
    string[],
  ];

  return {
    version: 'TanaIntermediateFile V0.1',
    summary,
    nodes: [node],
  };
}

export function convertObsidianFile(
  fileName: string, //without ending
  fileContent: string,
  summary: TanaIntermediateSummary = {
    leafNodes: 0,
    topLevelNodes: 0,
    totalNodes: 0,
    calendarNodes: 0,
    fields: 0,
    brokenRefs: 0,
  },
  today: number = Date.now(),
  idGenerator: IdGenerator = idgenerator,
  uidFinder: UidFinder = (link) => link,
): [TanaIntermediateNode, TanaIntermediateSummary, string[]] {
  let newPages: string[] = [];
  let obsidianNodes = fileContentToNodes(fileContent);
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

  const rootNode = createFileNode(displayName, today, uidFinder);
  summary.topLevelNodes++;

  summary.leafNodes += obsidianNodes.length;
  summary.totalNodes += 1 + obsidianNodes.length;
  //TODO: broken refs

  const lastObsidianNodes: ObsidianNode[] = [{ type: HierarchyType.ROOT, level: -1 } as ObsidianNode];
  const lastTanaNodes = [rootNode];

  for (const node of obsidianNodes) {
    const childNode = createChildNode(node, today, idGenerator);
    processRawTanaNode(childNode);
    if (childNode.refs) {
      newPages.push(...childNode.refs);
    }
    insertNodeIntoHierarchy(childNode, node, lastObsidianNodes, lastTanaNodes);
  }

  return [rootNode, summary, newPages];
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
  obsidianNode: ObsidianNode,
  lastObsidianNodes: ObsidianNode[],
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
  obsidianNode: ObsidianNode,
  lastObsidianNodes: ObsidianNode[],
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

function isChild(potentialParent: ObsidianNode, potentialChild: ObsidianNode) {
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
