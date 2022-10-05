import { NodeType, TanaIntermediateNode } from '../../types/types';
import { getBracketLinks } from '../../utils/utils';
import { MarkdownNode } from './extractMarkdownNodes';
import { UidRequestType, VaultContext } from './VaultContext';

export function convertMarkdownNode(
  obsidianNode: MarkdownNode,
  today: number,
  context: VaultContext,
): TanaIntermediateNode {
  const childNode = {
    uid: context.idGenerator(),
    name: obsidianNode.content,
    createdAt: today,
    editedAt: today,
    type: 'node' as NodeType,
  };

  processRawTanaNode(childNode, context);

  return childNode;
}

function processRawTanaNode(tanaNode: TanaIntermediateNode, vaultContext: VaultContext) {
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

  const foundUids = getBracketLinks(tanaNode.name, true).map((link) => [
    link,
    vaultContext.uidRequest(link, UidRequestType.CONTENT),
  ]);

  if (foundUids.length > 0 && !tanaNode.refs) {
    tanaNode.refs = [];
  }

  for (const [link, uid] of foundUids) {
    tanaNode.refs?.push(uid);
    tanaNode.name = tanaNode.name.replaceAll('[[' + link + ']]', '[[' + uid + ']]');
  }
}
