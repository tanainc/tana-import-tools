import { NodeType, TanaIntermediateNode } from '../../types/types';
import { UidRequestType, VaultContext } from './VaultContext';

export function createUnlinkedTanaNodes(
  importName: string,
  today: number,
  vaultContext: VaultContext,
): TanaIntermediateNode {
  const rootNodeName = 'Missing Nodes for ' + importName;
  const rootNode: TanaIntermediateNode = {
    //type here does not matter anymore
    uid: vaultContext.uidRequest(rootNodeName, UidRequestType.FOLDER),
    name: rootNodeName,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };

  const unlinkedNodes = vaultContext
    .getUnlinkedNodes()
    .sort((a, b) => a.obsidianLink.localeCompare(b.obsidianLink))
    .map((node) => ({
      uid: node.uid,
      name: node.obsidianLink,
      createdAt: today,
      editedAt: today,
      type: 'node' as NodeType,
    }));

  rootNode.children = unlinkedNodes;

  return rootNode;
}
