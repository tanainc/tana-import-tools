import { NodeType, TanaIntermediateNode } from '../../types/types';
import { getBracketLinks } from '../../utils/utils';
import { MarkdownNode } from './extractMarkdownNodes';
import { UidRequestType, VaultContext } from './VaultContext';

export function convertMarkdownNode(
  fileName: string,
  obsidianNode: MarkdownNode,
  today: number,
  vaultContext: VaultContext,
): TanaIntermediateNode {
  const [uid, content] = vaultContext.contentUid(fileName, obsidianNode.content);
  const tanaNode: TanaIntermediateNode = {
    uid,
    name: content,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };

  //TODO: reuse the regexs

  //TODO: aliases
  //TODO: convert to different node types, remove markdown formatting etc.
  const n = tanaNode.name;
  tanaNode.name = tanaNode.name.replace('collapsed:: true', '').replace(/^#+ /, '').trim();
  // links with alias
  tanaNode.name = tanaNode.name.replace(/\[\[([^|]+)\|([^\]]+)\]\]/g, '[$1]([[$2]])');
  // tags, convert to links for now
  tanaNode.name = tanaNode.name.replace(/(?:\s|^)(#([^[]]+?))(?:(?=\s)|$)/g, ' #[[$2]]');

  const foundUids = getBracketLinks(tanaNode.name, true).map((link) => [
    link,
    vaultContext.uidRequest(link, UidRequestType.CONTENT),
  ]);

  if (foundUids.length > 0 && !tanaNode.refs) {
    tanaNode.refs = [];
  }

  for (const [link, linkUid] of foundUids) {
    tanaNode.refs?.push(linkUid);
    tanaNode.name = tanaNode.name.replaceAll('[[' + link + ']]', '[[' + linkUid + ']]');
  }

  return tanaNode;
}
