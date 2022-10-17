import { NodeType, TanaIntermediateNode } from '../../../types/types';
import { filterInvalidBlockLinks } from './blockLinks';
import { untrackedUidRequest } from './genericLinks';
import { shiftFromLeafToTop, UidTracker, VaultContext } from '../VaultContext';
import { UidRequestType } from './internalLinks';

export function filterInvalidContentLinks(tracker: UidTracker) {
  const unlinkedNodes: { uid: string; link: string }[] = [];
  for (const node of tracker.getData()) {
    //at the end every uidData that has been only accessed from content (so inside the markdown file)
    //has no matching file node and is therefore unlinked
    //otherwise during the creation of the file node, it would have accessed the same Uid
    if (node.type === UidRequestType.CONTENT) {
      unlinkedNodes.push({ uid: node.uid, link: node.obsidianLink });
    }
  }
  return unlinkedNodes;
}

export function getAllInvalidLinks(context: VaultContext) {
  return [
    ...context.invalidLinks,
    ...filterInvalidContentLinks(context.defaultLinkTracker),
    ...filterInvalidBlockLinks(context.blockLinkTracker),
  ];
}

export function createUnlinkedTanaNodes(
  importName: string,
  today: number,
  context: VaultContext,
): TanaIntermediateNode | null {
  const unlinkedNodes = getAllInvalidLinks(context)
    .sort((a, b) => a.link.localeCompare(b.link))
    .map((node) => ({
      uid: node.uid,
      name: node.link,
      createdAt: today,
      editedAt: today,
      type: 'node' as NodeType,
    }));

  if (unlinkedNodes.length === 0) {
    return null;
  }

  const rootNodeName = 'Missing Nodes for ' + importName;
  const rootNode: TanaIntermediateNode = {
    uid: untrackedUidRequest(context),
    name: rootNodeName,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };
  shiftFromLeafToTop(context.summary);

  rootNode.children = unlinkedNodes;

  return rootNode;
}
