import { NodeType, TanaIntermediateNode } from '../../types/types';
import { VaultContext } from './VaultContext';

export function createUnlinkedTanaNodes(
  importName: string,
  today: number,
  vaultContext: VaultContext,
): TanaIntermediateNode | null {
  const unlinkedNodes = vaultContext
    .getAllInvalidContentLinks()
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
    //type here does not matter anymore
    uid: vaultContext.randomUid(),
    name: rootNodeName,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };

  rootNode.children = unlinkedNodes;

  return rootNode;
}
