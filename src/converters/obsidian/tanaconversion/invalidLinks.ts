import { NodeType, TanaIntermediateNode } from '../../../types/types';
import { filterInvalidBlockLinks } from './blockLinks';
import { filterInvalidContentLinks, untrackedUidRequest } from './uids';
import { VaultContext } from '../context';

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

  rootNode.children = unlinkedNodes;

  return rootNode;
}
